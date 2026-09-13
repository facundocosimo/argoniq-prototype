import { embedMany } from 'ai';
import { InternalError, getLogger, recordAiInteraction, type Logger } from '@argoniq/observability';
import { type VectorModel } from '../sdk/models.js';
import { type AiSdkOptions } from '../sdk/usage.js';
import {
  EMBEDDING_DIMENSIONS,
  EmbedRequest,
  assertEmbeddingShape,
  type EmbedResult,
  type EmbeddingsPort,
} from './embeddings-port.js';

/** One SDK path for query and document embeddings; vector width is a persistence contract. */
export class AiSdkEmbeddings implements EmbeddingsPort {
  readonly model: string;
  constructor(
    private readonly selected: VectorModel,
    private readonly logger: Logger = getLogger({ module: 'embeddings' }),
    private readonly options: AiSdkOptions = {},
  ) {
    this.model = selected.id;
  }

  async embed(raw: EmbedRequest): Promise<EmbedResult> {
    const request = EmbedRequest.parse(raw);
    const started = Date.now();
    try {
      const result = await embedMany({
        model: this.selected.model,
        values: request.inputs,
        providerOptions: this.selected.providerOptions,
        maxRetries: 0,
        maxParallelCalls: 1,
        abortSignal: AbortSignal.timeout(this.options.timeoutMs ?? 60_000),
      });
      assertEmbeddingShape(
        result.embeddings,
        request.inputs.length,
        (reason) => new InternalError(reason),
      );
      const usage = {
        capability: 'embed' as const,
        model: this.model,
        inputTokens: result.usage.tokens,
        outputTokens: 0,
        latencyMs: Date.now() - started,
      };
      this.logger.info(usage, 'AI embeddings completed');
      this.options.onUsage?.(usage);
      recordAiInteraction({
        provider: 'ai-sdk',
        capability: 'embed',
        model: this.model,
        request,
        usage: result.usage,
        latencyMs: usage.latencyMs,
      });
      return { vectors: result.embeddings, model: this.model, dimensions: EMBEDDING_DIMENSIONS };
    } catch (cause) {
      this.logger.error(
        { model: this.model, latencyMs: Date.now() - started },
        'AI embeddings failed',
      );
      throw new InternalError('AI embeddings failed', { cause });
    }
  }
}
