/** Provider-neutral usage emitted after a successful SDK call. No prompts or secrets. */
export type AiUsage = {
  readonly capability: 'classify' | 'answer' | 'reason' | 'embed';
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
};
export type AiSdkOptions = {
  readonly timeoutMs?: number;
  readonly maxOutputTokens?: number;
  readonly onUsage?: (usage: AiUsage) => void;
};
