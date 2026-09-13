import { getEnv } from '@argoniq/core-domain/env';
import { type Logger } from '@argoniq/observability';
import { createAiModels } from '../sdk/models.js';
import { AiSdkEmbeddings } from './ai-sdk-adapter.js';
import { FakeEmbeddings } from './fake-embeddings.js';
import { type EmbeddingsPort } from './embeddings-port.js';

export function resolveEmbeddingsPort(logger?: Logger): EmbeddingsPort {
  const env = getEnv();
  return env.AI_MODE === 'fake'
    ? new FakeEmbeddings()
    : new AiSdkEmbeddings(createAiModels(env).embeddingModel(), logger, {
        timeoutMs: env.AI_TIMEOUT_MS,
      });
}
