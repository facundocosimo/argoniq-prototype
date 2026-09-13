import { z } from 'zod';

/**
 * The embeddings port (contextual retrieval; the
 * `retrieval-architecture` memory). Hybrid retrieval needs a dense vector for every
 * chunk (at ingestion) and for every query (at answer time); this is the single seam
 * to the embedding model, exactly as `LlmPort` is the single seam to the generation
 * model. No layer constructs an embedding client directly — it depends on this
 * interface and is handed an implementation (`FakeEmbeddings` offline/in tests,
 * `AiSdkEmbeddings` in production), so the model can be swapped without touching callers.
 *
 * Everything crossing this trust edge is zod-validated : the request
 * batch is bounded and non-empty, and each returned vector's width is checked against
 * the column contract before it can reach the database.
 */

/**
 * The embedding width. MUST equal the `document_chunks.embedding vector(N)` column
 * (`packages/db` schema) — a mismatch is a boundary failure, never silently truncated.
 */
export const EMBEDDING_DIMENSIONS = 1024;

/**
 * Some embedding models produce ASYMMETRIC embeddings: a corpus passage
 * is embedded as a `document`, a search string as a `query`. Honoring the distinction
 * materially improves retrieval, so it is part of the port contract rather than an
 * adapter detail.
 */
export const EMBEDDING_INPUT_TYPES = ['document', 'query'] as const;
export const EmbeddingInputType = z.enum(EMBEDDING_INPUT_TYPES);
export type EmbeddingInputType = z.infer<typeof EmbeddingInputType>;

/**
 * The provider's per-request batch ceiling (`voyage-3-large` accepts up to 128
 * inputs). Bounding it at the edge turns an oversized batch into a fast, explicit
 * validation error rather than a provider 4xx mid-ingestion; callers chunk larger
 * workloads into batches of at most this size.
 */
export const MAX_EMBED_BATCH = 128;

export const EmbedRequest = z.object({
  /** The texts to embed, in caller order; the result vectors preserve this order. */
  inputs: z.array(z.string().min(1)).min(1).max(MAX_EMBED_BATCH),
  /** Whether these are corpus passages (`document`) or a search string (`query`). */
  inputType: EmbeddingInputType,
});
export type EmbedRequest = z.infer<typeof EmbedRequest>;

/** A single dense embedding — exactly {@link EMBEDDING_DIMENSIONS} finite numbers. */
export type EmbeddingVector = readonly number[];

export type EmbedResult = {
  /** One vector per input, in the same order as `request.inputs`. */
  readonly vectors: readonly EmbeddingVector[];
  /** The model id that produced the vectors (for provenance / token accounting). */
  readonly model: string;
  /** The vector width actually produced (always {@link EMBEDDING_DIMENSIONS}). */
  readonly dimensions: number;
};

/**
 * The narrow port every retrieval/ingestion caller depends on. Implemented by
 * `AiSdkEmbeddings` in production and `FakeEmbeddings` offline/in tests. Keeping it this
 * small means a layer can be unit-tested with the fake and the backend can be swapped
 * without touching callers.
 */
export interface EmbeddingsPort {
  /** Provider-qualified model identity; must match persisted document vectors. */
  readonly model: string;
  embed(request: EmbedRequest): Promise<EmbedResult>;
}

/**
 * Assert a backend returned well-formed vectors — the right COUNT, the contract WIDTH,
 * and finite components. Centralized here so every adapter validates the trust edge
 * identically (DRY); throws the caller-supplied error on the first violation so a
 * malformed embedding can never reach the `vector` column.
 */
export function assertEmbeddingShape(
  vectors: readonly EmbeddingVector[],
  expectedCount: number,
  onViolation: (reason: string) => Error,
): void {
  if (vectors.length !== expectedCount) {
    throw onViolation(`expected ${expectedCount} vectors, received ${vectors.length}`);
  }
  for (const [index, vector] of vectors.entries()) {
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw onViolation(
        `vector ${index} has width ${vector.length}, expected ${EMBEDDING_DIMENSIONS}`,
      );
    }
    if (!vector.every((component) => Number.isFinite(component))) {
      throw onViolation(`vector ${index} contains a non-finite component`);
    }
  }
}
