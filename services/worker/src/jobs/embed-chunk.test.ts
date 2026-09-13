import { describe, expect, it } from 'vitest';
import { DocumentChunkId, TenantId } from '@argoniq/core-domain';
import { embeddingInputHash, type ChunkRepository, type EmbeddableChunk } from '@argoniq/db';
import {
  EMBEDDING_DIMENSIONS,
  FAKE_EMBEDDINGS_MODEL,
  FakeEmbeddings,
} from '@argoniq/intelligence/embeddings';
import { type Logger } from '@argoniq/observability';
import { type EmbedChunkDeps, embedChunkJob } from './embed-chunk.js';

const TENANT = TenantId.parse('11111111-1111-4111-8111-111111111111');
const CHUNK = DocumentChunkId.parse('22222222-2222-4222-8222-222222222222');

const noopLogger = {
  error: () => undefined,
  warn: () => undefined,
  info: () => undefined,
  debug: () => undefined,
  trace: () => undefined,
  fatal: () => undefined,
  child: () => noopLogger,
} as unknown as Logger;

/** In-memory ChunkRepository — records writes and reflects them back, so the
 *  idempotency check (re-find sees `hasEmbedding: true`) is exercised faithfully. */
class FakeChunkRepository implements ChunkRepository {
  readonly saved = new Map<string, number[]>();
  readonly #store = new Map<string, EmbeddableChunk>();

  constructor(chunks: readonly EmbeddableChunk[]) {
    for (const chunk of chunks) this.#store.set(chunk.id, chunk);
  }

  find(_tenantId: TenantId, chunkId: DocumentChunkId): Promise<EmbeddableChunk | null> {
    return Promise.resolve(this.#store.get(chunkId) ?? null);
  }

  saveEmbedding(
    _tenantId: TenantId,
    chunkId: DocumentChunkId,
    embedding: readonly number[],
    metadata: { model: string; input: string },
  ): Promise<boolean> {
    this.saved.set(chunkId, [...embedding]);
    const existing = this.#store.get(chunkId);
    if (existing)
      this.#store.set(chunkId, {
        ...existing,
        hasEmbedding: true,
        embeddingModel: metadata.model,
        embeddingInputHash: embeddingInputHash(metadata.input),
      });
    return Promise.resolve(true);
  }

  listPendingEmbedding(_tenantId: TenantId): Promise<DocumentChunkId[]> {
    return Promise.resolve(
      [...this.#store.values()].filter((c) => !c.hasEmbedding).map((c) => c.id),
    );
  }
}

function makeChunk(overrides: Partial<EmbeddableChunk> = {}): EmbeddableChunk {
  return {
    id: CHUNK,
    content: 'surface marks at high line speed',
    contextualText: null,
    hasEmbedding: false,
    embeddingModel: null,
    embeddingInputHash: null,
    ...overrides,
  };
}

function depsFor(repo: ChunkRepository, embeddings = new FakeEmbeddings()): EmbedChunkDeps {
  return { chunks: repo, embeddings, logger: noopLogger };
}

const payload = { tenantId: TENANT, chunkId: CHUNK };

describe('embedChunkJob — idempotent ingestion stage', () => {
  it('embeds an un-embedded chunk and persists the vector', async () => {
    const repo = new FakeChunkRepository([makeChunk()]);
    const embeddings = new FakeEmbeddings();
    const outcome = await embedChunkJob(depsFor(repo, embeddings), payload);

    expect(outcome).toEqual({ status: 'embedded', model: FAKE_EMBEDDINGS_MODEL });
    expect(repo.saved.get(CHUNK)).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(embeddings.embedCalls).toHaveLength(1);
    expect(embeddings.embedCalls[0]?.inputs[0]).toBe('surface marks at high line speed');
    expect(embeddings.embedCalls[0]?.inputType).toBe('document');
  });

  it('is idempotent: a redelivery of an already-embedded chunk is a no-op', async () => {
    const repo = new FakeChunkRepository([makeChunk()]);
    const embeddings = new FakeEmbeddings();
    const deps = depsFor(repo, embeddings);

    const first = await embedChunkJob(deps, payload);
    const second = await embedChunkJob(deps, payload);

    expect(first.status).toBe('embedded');
    expect(second).toEqual({ status: 'skipped-existing' });
    // The chunk was embedded exactly once despite two deliveries.
    expect(embeddings.embedCalls).toHaveLength(1);
  });

  it('re-embeds an existing vector from a different provider/model', async () => {
    const repo = new FakeChunkRepository([
      makeChunk({ hasEmbedding: true, embeddingModel: 'old:model' }),
    ]);
    const embeddings = new FakeEmbeddings();
    expect((await embedChunkJob(depsFor(repo, embeddings), payload)).status).toBe('embedded');
    expect(embeddings.embedCalls).toHaveLength(1);
  });

  it('embeds the contextualized text when present (Contextual Retrieval)', async () => {
    const repo = new FakeChunkRepository([
      makeChunk({ contextualText: 'CONTEXT: Atlas Training Cell network. ' + 'raw chunk body' }),
    ]);
    const embeddings = new FakeEmbeddings();
    await embedChunkJob(depsFor(repo, embeddings), payload);

    expect(embeddings.embedCalls[0]?.inputs[0]).toContain('CONTEXT:');
  });

  it('treats a missing chunk as a no-op (deleted before processing)', async () => {
    const repo = new FakeChunkRepository([]);
    const embeddings = new FakeEmbeddings();
    const outcome = await embedChunkJob(depsFor(repo, embeddings), payload);

    expect(outcome).toEqual({ status: 'missing' });
    expect(repo.saved.size).toBe(0);
    expect(embeddings.embedCalls).toHaveLength(0);
  });

  it('rejects an invalid payload at the trust edge (zod)', async () => {
    const repo = new FakeChunkRepository([makeChunk()]);
    await expect(
      embedChunkJob(depsFor(repo), { tenantId: 'not-a-uuid', chunkId: CHUNK }),
    ).rejects.toThrow();
  });
});
