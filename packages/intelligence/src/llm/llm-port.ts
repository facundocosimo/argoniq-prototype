import { type SupportDraftInput, type SupportDraftExtraction } from '@argoniq/core-domain';
import { z } from 'zod';

/**
 * The LLM port (every layer reaches the model through here, never
 * the SDK directly;  "never call the LLM SDK directly from a
 * service — go through intelligence/llm").
 *
 * Conversational intake shares the classification model; grounded answers and
 * internal reasoning retain separate capabilities. The three model tiers (architecture model
 * tiering): `classify` (structured, forced-choice), `answer` (
 * grounded customer text), `reason` ( the hard diagnostic/internal-note
 * reasoning). Responses are typed; request assembly is the adapter's job.
 *
 * Everything that crosses this trust edge is zod-validated : the
 * model's classification output is parsed against the allowed label set so an
 * off-list or hallucinated label cannot leak downstream.
 */

/** The three model tiers, named by capability rather than by vendor model id. */
export const MODEL_TIERS = ['classify', 'answer', 'reason'] as const;
export const ModelTier = z.enum(MODEL_TIERS);
export type ModelTier = z.infer<typeof ModelTier>;

/** A forced-choice classification request (e.g. symptom normalization stage). */
export const ClassifyRequest = z.object({
  /** Instruction context (e.g. ontology description); assembled into the system prompt. */
  instructions: z.string().min(1),
  /** The raw input to classify (e.g. the customer's symptom wording). */
  input: z.string(),
  /**
   * The closed set of allowed labels. The model is constrained to emit exactly
   * one of these (forced choice + an explicit fallback the caller includes), so
   * the result is always on-list — never free generation ( stage 2).
   */
  labels: z.array(z.string().min(1)).min(1),
});
export type ClassifyRequest = z.infer<typeof ClassifyRequest>;

export type ClassifyResult = {
  /** The chosen label — guaranteed (by validation) to be a member of `labels`. */
  readonly label: string;
  /** Self-reported confidence in [0,1]; treated as a soft signal, not calibrated. */
  readonly confidence: number;
};

/** Conversational intake never supplies technical instructions or authorizes actions. */
export const ConversationRequest = z.object({
  phase: z.enum(['intake', 'no_evidence']),
  instructions: z.string().min(1),
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(4000) }))
    .max(20),
  machine: z.object({
    model: z.string().nullable(),
    family: z.string().nullable(),
    serialNumber: z.string(),
  }),
});
export type ConversationRequest = z.infer<typeof ConversationRequest>;
export const ConversationResult = z.object({
  action: z.enum(['reply', 'retrieve', 'support']),
  intent: z.enum(['problem', 'parameter', 'question']),
  /** Natural acknowledgement/clarification for reply; empty for retrieve. */
  message: z.string().max(1600),
});
export type ConversationResult = z.infer<typeof ConversationResult>;

/** A grounded customer-facing answer request. */
export const AnswerRequest = z.object({
  /** System instructions for the customer channel (grounding/tone rules). */
  instructions: z.string().min(1),
  /** The customer's question / current turn. */
  prompt: z.string(),
  /**
   * The customer-channel context blocks — already filtered to T1/owner-T2 by
   * `buildCustomerChannelContext`. The adapter must NOT add any other source.
   */
  context: z.array(z.string()).default([]),
});
export type AnswerRequest = z.infer<typeof AnswerRequest>;

export type AnswerResult = {
  readonly text: string;
  /** Live adapters return source selections verified against the supplied context. */
  readonly supported?: boolean;
  readonly sourceIndexes?: readonly number[];
};

/** A deep-reasoning request — internal-note / hard diagnostic reasoning. */
export const ReasonRequest = z.object({
  instructions: z.string().min(1),
  prompt: z.string(),
  /** Internal-channel context (may include T3) — used only for Mode D/E output. */
  context: z.array(z.string()).default([]),
});
export type ReasonRequest = z.infer<typeof ReasonRequest>;

export type ReasonResult = {
  readonly text: string;
};

/**
 * The narrow port every layer depends on. Implemented by `AiSdkLlm` in
 * production and `FakeLlm` in tests. Keeping it this small means a layer can be
 * unit-tested with the fake and the SDK can be swapped without touching callers.
 */
export interface LlmPort {
  prepareSupportDraft?(
    request: Pick<SupportDraftInput, 'history'>,
  ): Promise<SupportDraftExtraction>;
  converse(request: ConversationRequest): Promise<ConversationResult>;
  classify(request: ClassifyRequest): Promise<ClassifyResult>;
  answer(request: AnswerRequest): Promise<AnswerResult>;
  reason(request: ReasonRequest): Promise<ReasonResult>;
}
