import { describe, expect, it } from 'vitest';
import { EMBEDDING_DIMENSIONS, type EmbeddingVector } from './embeddings-port.js';
import { FAKE_EMBEDDINGS_MODEL, FakeEmbeddings } from './fake-embeddings.js';

/** Cosine similarity of two unit vectors == their dot product. */
function cosine(a: EmbeddingVector, b: EmbeddingVector): number {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot;
}

function l2norm(v: EmbeddingVector): number {
  let sumSq = 0;
  for (const x of v) sumSq += x * x;
  return Math.sqrt(sumSq);
}

async function embedOne(fake: FakeEmbeddings, text: string): Promise<EmbeddingVector> {
  const { vectors } = await fake.embed({ inputs: [text], inputType: 'document' });
  return vectors[0]!;
}

describe('FakeEmbeddings — deterministic offline embedder', () => {
  it('is deterministic: identical text yields an identical vector', async () => {
    const fake = new FakeEmbeddings();
    const a = await embedOne(fake, 'demo cable connection reference');
    const b = await embedOne(fake, 'demo cable connection reference');
    expect(a).toEqual(b);
  });

  it('produces unit-normalized vectors of the contract width', async () => {
    const fake = new FakeEmbeddings();
    const { vectors, model, dimensions } = await fake.embed({
      inputs: ['surface marks on finished panels'],
      inputType: 'query',
    });
    expect(vectors[0]).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(dimensions).toBe(EMBEDDING_DIMENSIONS);
    expect(model).toBe(FAKE_EMBEDDINGS_MODEL);
    expect(l2norm(vectors[0]!)).toBeCloseTo(1, 6);
  });

  it('is symmetric: query and document embeddings of the same text match (offline retrieval)', async () => {
    const fake = new FakeEmbeddings();
    const asQuery = (await fake.embed({ inputs: ['surface marks'], inputType: 'query' }))
      .vectors[0]!;
    const asDoc = (await fake.embed({ inputs: ['surface marks'], inputType: 'document' }))
      .vectors[0]!;
    expect(asQuery).toEqual(asDoc);
  });

  it('ranks a lexically-related passage above an unrelated one (cosine)', async () => {
    const fake = new FakeEmbeddings();
    const query = await embedOne(fake, 'surface marks caused by a loose roller');
    const related = await embedOne(fake, 'surface marks can follow a loose roller');
    const unrelated = await embedOne(fake, 'replace the air filter every six months');
    expect(cosine(query, related)).toBeGreaterThan(cosine(query, unrelated));
  });

  it('preserves input order across a batch', async () => {
    const fake = new FakeEmbeddings();
    const batch = await fake.embed({ inputs: ['alpha', 'beta', 'gamma'], inputType: 'document' });
    const alpha = await embedOne(fake, 'alpha');
    const gamma = await embedOne(fake, 'gamma');
    expect(batch.vectors).toHaveLength(3);
    expect(batch.vectors[0]).toEqual(alpha);
    expect(batch.vectors[2]).toEqual(gamma);
  });

  it('handles token-less input without producing NaN', async () => {
    const fake = new FakeEmbeddings();
    const v = await embedOne(fake, '!!! ??? ...');
    expect(v).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(v.every((n) => Number.isFinite(n))).toBe(true);
    expect(l2norm(v)).toBeCloseTo(1, 6);
  });

  it('records the requests it received', async () => {
    const fake = new FakeEmbeddings();
    await fake.embed({ inputs: ['one', 'two'], inputType: 'query' });
    expect(fake.embedCalls).toHaveLength(1);
    expect(fake.embedCalls[0]?.inputs).toEqual(['one', 'two']);
    expect(fake.embedCalls[0]?.inputType).toBe('query');
  });

  it('rejects an empty batch and a blank input (zod edge validation)', async () => {
    const fake = new FakeEmbeddings();
    await expect(fake.embed({ inputs: [], inputType: 'query' })).rejects.toThrow();
    await expect(fake.embed({ inputs: [''], inputType: 'query' })).rejects.toThrow();
  });

  it('rejects an over-cap batch (zod edge validation)', async () => {
    const fake = new FakeEmbeddings();
    const tooMany = Array.from({ length: 129 }, (_, i) => `chunk ${i}`);
    await expect(fake.embed({ inputs: tooMany, inputType: 'document' })).rejects.toThrow();
  });
});
