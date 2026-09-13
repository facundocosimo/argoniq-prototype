import { z } from 'zod';
import { DocumentChunkId, DocumentId, TenantId } from '@argoniq/core-domain';

/**
 * Background-job contracts — the ONLY thing shared between the enqueuer (web tier)
 * and the consumer (`services/worker`). Keeping the queue names and payload schemas
 * here (not in the worker) lets the portal enqueue a job without importing the worker's
 * heavy parse/embed deps, while both sides validate the same shape at the trust edge.
 */

/** parse→chunk→index one uploaded document. */
export const INGEST_DOCUMENT_QUEUE = 'ingest-document';
export const IngestDocumentPayload = z.object({
  tenantId: TenantId,
  documentId: DocumentId,
});
export type IngestDocumentPayload = z.infer<typeof IngestDocumentPayload>;

/** Embed one persisted chunk (the dense half of the hybrid index). */
export const EMBED_CHUNK_QUEUE = 'embed-chunk';
export const EmbedChunkPayload = z.object({
  tenantId: TenantId,
  chunkId: DocumentChunkId,
});
export type EmbedChunkPayload = z.infer<typeof EmbedChunkPayload>;

/** Every queue name — used to create queues on both producer and consumer start. */
export const ALL_QUEUES = [INGEST_DOCUMENT_QUEUE, EMBED_CHUNK_QUEUE] as const;
