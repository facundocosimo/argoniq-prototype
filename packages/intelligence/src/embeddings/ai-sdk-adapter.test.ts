import { describe, expect, it, vi } from 'vitest';
import { MockEmbeddingModelV4 } from 'ai/test';
import { type Logger } from '@argoniq/observability';
import { AiSdkEmbeddings } from './ai-sdk-adapter.js';
const logger = { info: vi.fn(), error: vi.fn() } as unknown as Logger;
describe('AI SDK embeddings adapter', () => {
  it('preserves input order and records the provider-qualified identity', async () => {
    const model = new MockEmbeddingModelV4({
      maxEmbeddingsPerCall: 128,
      doEmbed: ({ values }) =>
        Promise.resolve({
          embeddings: values.map((_, i) => Array<number>(1024).fill(i + 1)),
          usage: { tokens: 4 },
          warnings: [],
        }),
    });
    const adapter = new AiSdkEmbeddings(
      {
        id: 'openai:text-embedding-3-small',
        model,
        providerOptions: { openai: { dimensions: 1024 } },
      },
      logger,
    );
    const result = await adapter.embed({ inputs: ['first', 'second'], inputType: 'document' });
    expect(result.model).toBe(adapter.model);
    expect(result.vectors.map((v) => v[0])).toEqual([1, 2]);
    expect(model.doEmbedCalls[0]?.providerOptions).toEqual({ openai: { dimensions: 1024 } });
  });
  it.each([
    { vectors: [[1, 2]] },
    { vectors: [Array<number>(1024).fill(NaN)] },
    { vectors: [] as number[][] },
  ])('rejects incompatible vectors', async ({ vectors }) => {
    const model = new MockEmbeddingModelV4({
      maxEmbeddingsPerCall: 128,
      doEmbed: () => Promise.resolve({ embeddings: vectors, warnings: [] }),
    });
    const adapter = new AiSdkEmbeddings(
      { id: 'test:embedding', model, providerOptions: {} },
      logger,
    );
    await expect(adapter.embed({ inputs: ['query'], inputType: 'query' })).rejects.toMatchObject({
      code: 'INTERNAL',
    });
  });
});
