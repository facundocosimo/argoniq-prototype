import { deliverPendingSupport } from './jobs/deliver-support.js';
/* eslint-disable no-restricted-globals -- service entrypoint: reads env at boot, handles process signals + exit code. */
import {
  DrizzleChunkRepository,
  DrizzleDocumentRepository,
  CaseDeliveryRepository,
  createDatabase,
} from '@argoniq/db';
import { resolveEmbeddingsPort } from '@argoniq/intelligence/embeddings';
import { getLogger } from '@argoniq/observability';
import { LocalDiskStorage, resolveLocalRoot } from '@argoniq/storage';
import { getWorkerConfig } from './config.js';
import { type EmbedChunkDeps, type IngestDocumentDeps } from './jobs/index.js';
import { PdfjsParser } from './ingestion/pdfjs-parser.js';
import {
  enqueueEmbedChunk,
  enqueueIngestDocument,
  registerEmbedChunkWorker,
  registerIngestDocumentWorker,
  startQueue,
} from './queue.js';

/**
 * Worker entrypoint (`pnpm --filter @argoniq/worker start`). Composes the
 * dependencies, starts the queue, registers the ingestion workers, and shuts down
 * gracefully on a termination signal so in-flight jobs are allowed to finish.
 *
 * Live embeddings use the same AI SDK model configuration as the portal.
 * Only explicit `AI_MODE=fake` selects the offline deterministic adapter.
 */
async function main(): Promise<void> {
  const logger = getLogger({ module: 'worker' });
  const config = getWorkerConfig();

  const db = createDatabase(config.databaseUrl);
  const storage = new LocalDiskStorage({ root: resolveLocalRoot(config.storageRoot) });

  const embedDeps: EmbedChunkDeps = {
    chunks: new DrizzleChunkRepository(db),
    embeddings: resolveEmbeddingsPort(logger),
    logger,
  };
  const ingestDeps: Omit<IngestDocumentDeps, 'enqueueEmbed'> = {
    documents: new DrizzleDocumentRepository(db),
    storage,
    parser: new PdfjsParser(),
    logger,
  };

  const boss = await startQueue(config.queueConnectionString, logger);
  await registerEmbedChunkWorker(boss, embedDeps);
  await registerIngestDocumentWorker(boss, ingestDeps);
  let delivering = false;
  const deliver = async () => {
    if (delivering) return;
    delivering = true;
    try {
      await deliverPendingSupport(new CaseDeliveryRepository(db), storage);
    } catch (error) {
      logger.error({ err: error }, 'support delivery recovery failed');
    } finally {
      delivering = false;
    }
  };
  void deliver();
  const supportTimer = setInterval(() => void deliver(), 30_000);
  let recovering = false;
  const recover = async () => {
    if (recovering) return;
    recovering = true;
    try {
      for (const work of await new DrizzleDocumentRepository(db).pendingWork()) {
        for (const documentId of work.documentIds)
          await enqueueIngestDocument(boss, { tenantId: work.tenantId, documentId });
        for (const chunkId of work.chunkIds)
          await enqueueEmbedChunk(boss, { tenantId: work.tenantId, chunkId });
        for (const key of work.deletedKeys) await storage.delete(key);
      }
    } catch (error) {
      logger.error({ err: error }, 'document recovery failed; retrying next interval');
    } finally {
      recovering = false;
    }
  };
  await recover();
  const recoveryTimer = setInterval(() => void recover(), 30_000);
  logger.info('worker started; consuming the ingest-document + embed-chunk queues');

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info({ signal }, 'worker shutting down');
    clearInterval(recoveryTimer);
    clearInterval(supportTimer);
    await boss.stop({ graceful: true });
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  getLogger({ module: 'worker' }).error({ err: error }, 'worker failed to start');
  process.exitCode = 1;
});
