import { PgBoss } from 'pg-boss';
import {
  EMBED_CHUNK_QUEUE,
  type EmbedChunkPayload,
  INGEST_DOCUMENT_QUEUE,
  type IngestDocumentPayload,
} from '@argoniq/jobs';
import { type Logger } from '@argoniq/observability';
import {
  type EmbedChunkDeps,
  type IngestDocumentDeps,
  embedChunkJob,
  ingestDocumentJob,
} from './jobs/index.js';

/** Start pg-boss, create queues, register workers, and expose worker-side enqueue helpers. */

/** Retry transient ingestion failures with exponential backoff and a finite limit. */
const RETRY_POLICY = { retryLimit: 5, retryBackoff: true } as const;

/**
 * Start pg-boss and ensure every queue exists (v10+ requires explicit creation before
 * send/work). Errors are surfaced through the injected logger rather than crashing the
 * process on a transient backend hiccup.
 */
export async function startQueue(connectionString: string, logger: Logger): Promise<PgBoss> {
  const boss = new PgBoss(connectionString);
  boss.on('error', (error: unknown) => logger.error({ err: error }, 'pg-boss error'));
  await boss.start();
  await boss.createQueue(EMBED_CHUNK_QUEUE);
  await boss.createQueue(INGEST_DOCUMENT_QUEUE);
  return boss;
}

/** Producer: enqueue a chunk for embedding with the standard retry policy. */
export async function enqueueEmbedChunk(boss: PgBoss, payload: EmbedChunkPayload): Promise<void> {
  await boss.send(EMBED_CHUNK_QUEUE, payload, {
    ...RETRY_POLICY,
    singletonKey: payload.chunkId,
    singletonSeconds: 30,
  });
}

/** Producer: enqueue an uploaded document for parse→chunk→index. */
export async function enqueueIngestDocument(
  boss: PgBoss,
  payload: IngestDocumentPayload,
): Promise<void> {
  await boss.send(INGEST_DOCUMENT_QUEUE, payload, {
    ...RETRY_POLICY,
    singletonKey: payload.documentId,
    singletonSeconds: 30,
  });
}

/**
 * Register the ingest-document worker. Each document is one job; on success it fans out
 * one embed-chunk job per persisted chunk via the injected `enqueueEmbed`. `batchSize: 1`
 * keeps retry/backoff per document. The handler is glue — `ingestDocumentJob` does the work.
 */
export async function registerIngestDocumentWorker(
  boss: PgBoss,
  deps: Omit<IngestDocumentDeps, 'enqueueEmbed'>,
): Promise<void> {
  const enqueueEmbed: IngestDocumentDeps['enqueueEmbed'] = ({ tenantId, chunkId }) =>
    boss
      .send(
        EMBED_CHUNK_QUEUE,
        { tenantId, chunkId },
        { ...RETRY_POLICY, singletonKey: chunkId, singletonSeconds: 30 },
      )
      .then(() => undefined);
  await boss.work<IngestDocumentPayload>(INGEST_DOCUMENT_QUEUE, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      await ingestDocumentJob({ ...deps, enqueueEmbed }, job.data);
    }
  });
}

/**
 * Register the embed-chunk worker. `batchSize: 1` makes retry/backoff per chunk (one
 * job per handler invocation); a throw fails just that job, which pg-boss then retries
 * under {@link RETRY_POLICY}. The handler is only glue — `embedChunkJob` does the work.
 */
export async function registerEmbedChunkWorker(boss: PgBoss, deps: EmbedChunkDeps): Promise<void> {
  await boss.work<EmbedChunkPayload>(EMBED_CHUNK_QUEUE, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      await embedChunkJob(deps, job.data);
    }
  });
}
