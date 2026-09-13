import { getEnv } from '@argoniq/core-domain/env';
import { type Logger } from '@argoniq/observability';
import { createAiModels } from '../sdk/models.js';
import { AiSdkLlm } from './ai-sdk-adapter.js';
import { FakeLlm } from './fake-llm.js';
import { type LlmPort } from './llm-port.js';

export function resolveLlmPort(logger?: Logger): LlmPort {
  const env = getEnv();
  return env.AI_MODE === 'fake'
    ? new FakeLlm()
    : new AiSdkLlm(createAiModels(env).textModels(), logger, { timeoutMs: env.AI_TIMEOUT_MS });
}
