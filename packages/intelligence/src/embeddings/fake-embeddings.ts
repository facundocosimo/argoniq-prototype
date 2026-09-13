import {
  EMBEDDING_DIMENSIONS,
  EmbedRequest,
  type EmbedResult,
  type EmbeddingVector,
  type EmbeddingsPort,
} from './embeddings-port.js';

/**
 * Deterministic offline embeddings for tests and local sample data.
 *
 * Tokens are assigned to signed hash buckets, summed, and normalized. Shared
 * tokens therefore produce some shared signal without a model or network call.
 * This is useful for exercising retrieval code, but it is not a substitute for
 * evaluating a production embedding model.
 */
export const FAKE_EMBEDDINGS_MODEL = 'fake-deterministic-1024';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1a(text: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => token.length > 1);
}

function hashEmbed(text: string): EmbeddingVector {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    vector[fnv1a(text) % EMBEDDING_DIMENSIONS] = 1;
    return vector;
  }

  for (const token of tokens) {
    const bucket = fnv1a(token) % EMBEDDING_DIMENSIONS;
    const sign = (fnv1a(`${token}\0sign`) & 1) === 0 ? 1 : -1;
    vector[bucket] = (vector[bucket] ?? 0) + sign;
  }

  let sumOfSquares = 0;
  for (const component of vector) sumOfSquares += component * component;
  const norm = Math.sqrt(sumOfSquares);

  if (norm === 0) {
    vector[fnv1a(text) % EMBEDDING_DIMENSIONS] = 1;
    return vector;
  }

  return vector.map((component) => component / norm);
}

export class FakeEmbeddings implements EmbeddingsPort {
  readonly model = FAKE_EMBEDDINGS_MODEL;
  readonly embedCalls: EmbedRequest[] = [];

  embed(request: EmbedRequest): Promise<EmbedResult> {
    return Promise.resolve().then(() => {
      const parsed = EmbedRequest.parse(request);
      this.embedCalls.push(parsed);
      return {
        vectors: parsed.inputs.map(hashEmbed),
        model: FAKE_EMBEDDINGS_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
      };
    });
  }
}
