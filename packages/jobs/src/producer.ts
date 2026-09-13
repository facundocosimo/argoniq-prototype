import { PgBoss } from 'pg-boss';
import { getLogger } from '@argoniq/observability';
import {
  EMBED_CHUNK_QUEUE,
  type EmbedChunkPayload,
  INGEST_DOCUMENT_QUEUE,
  type IngestDocumentPayload,
} from './contracts.js';

/**
 * A minimal pg-boss PRODUCER for the web tier. Unlike the worker's boss (which also
 * consumes + runs maintenance), this instance only sends: `supervise`/`schedule` are
 * off so it doesn't run the queue's housekeeping loops. It ensures the queues exist
 * (idempotent) so an enqueue can't race ahead of the worker's own `createQueue`.
 */
export interface JobProducer {
  enqueueIngestDocument(payload: IngestDocumentPayload): Promise<void>;
  enqueueEmbedChunk(payload: EmbedChunkPayload): Promise<void>;
  stop(): Promise<void>;
}

const RETRY_POLICY = { retryLimit: 5, retryBackoff: true } as const;

export async function createJobProducer(connectionString: string): Promise<JobProducer> {
  const boss = new PgBoss({ connectionString, supervise: false, schedule: false });
  boss.on('error', (error: unknown) =>
    getLogger({ module: 'jobs' }).error({ err: error }, 'pg-boss producer error'),
  );
  await boss.start();
  await boss.createQueue(INGEST_DOCUMENT_QUEUE);
  await boss.createQueue(EMBED_CHUNK_QUEUE);

  return {
    async enqueueIngestDocument(payload) {
      await boss.send(INGEST_DOCUMENT_QUEUE, payload, {
        ...RETRY_POLICY,
        singletonKey: payload.documentId,
        singletonSeconds: 30,
      });
    },
    async enqueueEmbedChunk(payload) {
      await boss.send(EMBED_CHUNK_QUEUE, payload, {
        ...RETRY_POLICY,
        singletonKey: payload.chunkId,
        singletonSeconds: 30,
      });
    },
    async stop() {
      await boss.stop({ graceful: true });
    },
  };
}

/**
 * Process-wide memoized producer. The web server enqueues through one shared pg-boss
 * connection for its lifetime rather than reconnecting per request. Reads the queue DB
 * from env (falls back to the app DB, matching the worker's `getWorkerConfig`).
 */
let cached: Promise<JobProducer> | undefined;

export function getJobProducer(connectionString: string): Promise<JobProducer> {
  cached ??= createJobProducer(connectionString).catch((error) => {
    cached = undefined;
    throw error;
  });
  return cached;
}
