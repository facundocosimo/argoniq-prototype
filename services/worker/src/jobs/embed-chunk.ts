import { embeddingInputHash, type ChunkRepository } from '@argoniq/db';
import { type EmbeddingsPort } from '@argoniq/intelligence/embeddings';
import { EmbedChunkPayload } from '@argoniq/jobs';
import { type Logger } from '@argoniq/observability';

export type EmbedChunkDeps = {
  readonly chunks: ChunkRepository;
  readonly embeddings: EmbeddingsPort;
  readonly logger: Logger;
};

/** Result recorded for retries and metrics. */
export type EmbedChunkOutcome =
  | { readonly status: 'embedded'; readonly model: string }
  | { readonly status: 'skipped-existing' }
  | { readonly status: 'stale' }
  | { readonly status: 'missing' };

/**
 * Embed one document chunk. Each chunk is a separate retryable job. Existing
 * embeddings with the same model and input hash are left unchanged.
 */
export async function embedChunkJob(
  deps: EmbedChunkDeps,
  rawPayload: unknown,
): Promise<EmbedChunkOutcome> {
  const { tenantId, chunkId } = EmbedChunkPayload.parse(rawPayload);
  const { chunks, embeddings, logger } = deps;

  const chunk = await chunks.find(tenantId, chunkId);
  if (!chunk) {
    logger.warn({ chunkId }, 'embed-chunk: chunk not found; nothing to do');
    return { status: 'missing' };
  }
  const text = chunk.contextualText ?? chunk.content;
  if (
    chunk.hasEmbedding &&
    chunk.embeddingModel === embeddings.model &&
    chunk.embeddingInputHash === embeddingInputHash(text)
  ) {
    logger.debug({ chunkId }, 'embed-chunk: already embedded; skipping (idempotent)');
    return { status: 'skipped-existing' };
  }

  // Embed the contextualized text when present (Contextual Retrieval prepends per-chunk
  // context before embedding); otherwise the raw chunk. The dense vector is built from
  // this text; the lexical (BM25) arm searches `content` directly.
  const { vectors, model } = await embeddings.embed({ inputs: [text], inputType: 'document' });
  const saved = await chunks.saveEmbedding(tenantId, chunkId, vectors[0]!, { model, input: text });
  if (!saved) return { status: 'stale' };

  logger.info({ chunkId, model }, 'embed-chunk: embedded');
  return { status: 'embedded', model };
}
