import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import {
  createGateway,
  createProviderRegistry,
  type generateText,
  type LanguageModel,
  type EmbeddingModel,
} from 'ai';
import { type Env } from '@argoniq/core-domain/env';
import { InternalError } from '@argoniq/observability';
import { EMBEDDING_DIMENSIONS } from '../embeddings/embeddings-port.js';
import { type ModelTier } from '../llm/llm-port.js';

export type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]['providerOptions']>;
export type TextModel = {
  readonly id: string;
  readonly model: LanguageModel;
  readonly providerOptions: ProviderOptions;
};
export type VectorModel = {
  readonly id: string;
  readonly model: EmbeddingModel;
  readonly providerOptions: ProviderOptions;
};

/** The only vendor-aware composition point. Services receive ports, never SDK clients. */
export function createAiModels(env: Env, fetchFn?: typeof fetch) {
  const transport = fetchFn ? { fetch: fetchFn } : {};
  const registry = createProviderRegistry({
    openai: createOpenAI({
      ...transport,
      ...(env.OPENAI_API_KEY ? { apiKey: env.OPENAI_API_KEY } : {}),
    }),
    anthropic: createAnthropic({
      ...transport,
      ...(env.ANTHROPIC_API_KEY ? { apiKey: env.ANTHROPIC_API_KEY } : {}),
    }),
    gateway: createGateway({
      ...transport,
      ...(env.AI_GATEWAY_API_KEY ? { apiKey: env.AI_GATEWAY_API_KEY } : {}),
    }),
  });
  function requireCredential(id: string) {
    const provider = id.split(':')[0];
    const key =
      provider === 'openai'
        ? env.OPENAI_API_KEY
        : provider === 'anthropic'
          ? env.ANTHROPIC_API_KEY
          : provider === 'gateway'
            ? env.AI_GATEWAY_API_KEY
            : undefined;
    if (!key) throw new InternalError(`No credential configured for AI provider ${provider}`);
  }
  function text(id: string): TextModel {
    requireCredential(id);
    return {
      id,
      model: registry.languageModel(id as Parameters<typeof registry.languageModel>[0]),
      providerOptions:
        id.startsWith('openai:') || id.startsWith('gateway:openai/')
          ? {
              openai: {
                store: false,
                serviceTier: 'default',
                reasoningEffort: env.AI_REASONING_EFFORT,
                textVerbosity: 'low',
              },
            }
          : {},
    };
  }
  return {
    textModels(): Record<ModelTier, TextModel> {
      return {
        classify: text(env.AI_MODEL_CLASSIFY),
        answer: text(env.AI_MODEL_ANSWER),
        reason: text(env.AI_MODEL_REASON),
      };
    },
    embeddingModel(): VectorModel {
      const id = env.AI_EMBEDDING_MODEL;
      requireCredential(id);
      return {
        id,
        model: registry.embeddingModel(id as Parameters<typeof registry.embeddingModel>[0]),
        providerOptions: { openai: { dimensions: EMBEDDING_DIMENSIONS } },
      };
    },
  };
}
