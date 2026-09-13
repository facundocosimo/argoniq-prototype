import { getEnv } from '@argoniq/core-domain/env';
import { resolveEmbeddingsPort, resolveLlmPort } from '@argoniq/intelligence';
import {
  AnswerSymptomInput,
  DrizzleChunkSearch,
  answerSymptom,
} from '../../../services/intelligence/index.js';
import { protectedProcedure, router } from '../trpc.js';

/**
 * Intelligence router — a THIN adapter over the answer service. The procedure
 * parses input (tRPC), then calls `answerSymptom`, which re-validates,
 * re-authorizes, runs the -gated pipeline, audits, and offers support when needed.
 * No logic lives here. It is a mutation for model work/audit; chat never writes a case.
 *
 * AI SDK adapters are composed from the validated model configuration.
 * Explicit offline mode uses lexical retrieval; live mode uses compatible dense vectors.
 */
export const intelligenceRouter = router({
  answer: protectedProcedure.input(AnswerSymptomInput).mutation(({ ctx, input }) =>
    answerSymptom(ctx.service, input, {
      llm: resolveLlmPort(ctx.service.logger),
      embeddings: resolveEmbeddingsPort(ctx.service.logger),
      search: new DrizzleChunkSearch(),
      retrievalMode: getEnv().AI_MODE === 'fake' ? 'lexical' : 'hybrid',
    }),
  ),
});
