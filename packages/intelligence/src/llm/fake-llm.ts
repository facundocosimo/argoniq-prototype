import {
  type AnswerRequest,
  type AnswerResult,
  type ClassifyRequest,
  type ClassifyResult,
  type ConversationRequest,
  type ConversationResult,
  type LlmPort,
  type ReasonRequest,
  type ReasonResult,
} from './llm-port.js';

/**
 * A deterministic `LlmPort` for unit tests — no network, no SDK. Each capability
 * can be stubbed with a scripted response or a function; otherwise it returns a
 * safe default (classify → first label at zero confidence, so the caller's
 * threshold routes to UNMAPPED, the conservative path). Also records the requests
 * it received so tests can assert on what a layer asked the model.
 */
export type FakeLlmScript = {
  converse?: ConversationResult | ((request: ConversationRequest) => ConversationResult);
  classify?: ClassifyResult | ((request: ClassifyRequest) => ClassifyResult);
  answer?: AnswerResult | ((request: AnswerRequest) => AnswerResult);
  reason?: ReasonResult | ((request: ReasonRequest) => ReasonResult);
};

export class FakeLlm implements LlmPort {
  readonly conversationCalls: ConversationRequest[] = [];
  readonly classifyCalls: ClassifyRequest[] = [];
  readonly answerCalls: AnswerRequest[] = [];
  readonly reasonCalls: ReasonRequest[] = [];

  readonly #script: FakeLlmScript;

  constructor(script: FakeLlmScript = {}) {
    this.#script = script;
  }

  converse(request: ConversationRequest): Promise<ConversationResult> {
    this.conversationCalls.push(request);
    const scripted = this.#script.converse;
    if (typeof scripted === 'function') return Promise.resolve(scripted(request));
    if (scripted) return Promise.resolve(scripted);
    // Offline fixture only; live conversational quality requires the real adapter.
    return Promise.resolve(
      request.phase === 'no_evidence'
        ? {
            action: 'reply',
            intent: 'question',
            message: 'This offline fixture has no supporting information for that question.',
          }
        : { action: 'retrieve', intent: 'problem', message: '' },
    );
  }

  classify(request: ClassifyRequest): Promise<ClassifyResult> {
    this.classifyCalls.push(request);
    const scripted = this.#script.classify;
    if (typeof scripted === 'function') return Promise.resolve(scripted(request));
    if (scripted) return Promise.resolve(scripted);
    // Conservative default: pick the first label with zero confidence.
    return Promise.resolve({ label: request.labels[0]!, confidence: 0 });
  }

  answer(request: AnswerRequest): Promise<AnswerResult> {
    this.answerCalls.push(request);
    const scripted = this.#script.answer;
    if (typeof scripted === 'function') return Promise.resolve(scripted(request));
    if (scripted) return Promise.resolve(scripted);
    return Promise.resolve({ text: '' });
  }

  reason(request: ReasonRequest): Promise<ReasonResult> {
    this.reasonCalls.push(request);
    const scripted = this.#script.reason;
    if (typeof scripted === 'function') return Promise.resolve(scripted(request));
    if (scripted) return Promise.resolve(scripted);
    return Promise.resolve({ text: '' });
  }
}
