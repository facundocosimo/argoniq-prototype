import { pino, destination as pinoDestination, type Logger } from 'pino';
import { getEnv } from '@argoniq/core-domain/env';
import { getContext } from './context.js';
import { getLogger } from './logger.js';

/**
 * The centralized AI debug transcript — one local JSONL file that captures every
 * interaction with an AI provider (the request payload sent, the response, token
 * usage, latency, and errors). It is the single sink for "log everything the app
 * says to and hears back from a model", so debugging a bad answer is reading one
 * file instead of correlating scattered logs.
 *
 * This is a DEBUG facility and it is OFF by default. When enabled it writes full
 * prompts and responses — including customer text and other PII — to a local file
 * that is never shipped anywhere. Keep `AI_DEBUG_TRANSCRIPT=false` in production;
 * turn it on locally (`AI_DEBUG_TRANSCRIPT=true`) when you need the transcript.
 *
 * Write your own line with {@link recordAiInteraction}; providers (the AI SDK adapters) already call it, so live model traffic is captured with no
 * per-caller wiring.
 */
export type AiInteraction = {
  /** Provider making the call, e.g. `anthropic` (chat) or `voyage` (embeddings). */
  readonly provider: string;
  /** Capability / model tier, e.g. `classify` | `answer` | `reason` | `embed`. */
  readonly capability: string;
  /** The resolved model id the request was sent to. */
  readonly model: string;
  /** The full request payload sent to the provider (system, messages, params…). */
  readonly request: unknown;
  /** The response payload (content blocks, text, counts…) — omitted when the call errored. */
  readonly response?: unknown;
  /** Provider-reported token usage, when available. */
  readonly usage?: unknown;
  /** Wall-clock latency of the call, in milliseconds. */
  readonly latencyMs: number;
  /** Present only when the call threw — the error name/message. */
  readonly error?: { readonly name: string; readonly message: string };
};

// `undefined` = not yet resolved; `null` = resolved-and-disabled. Resolved once,
// lazily, so importing this module never touches the filesystem.
let sink: Logger | null | undefined;

function transcriptSink(): Logger | null {
  if (sink !== undefined) return sink;
  try {
    // Env is read inside the try so a misconfigured/absent env (e.g. a unit test
    // that never loads full config) silently disables the transcript rather than
    // taking the caller down — debug logging must never crash a request.
    const env = getEnv();
    if (!env.AI_DEBUG_TRANSCRIPT) {
      sink = null;
      return sink;
    }
    // A plain in-process file stream (sonic-boom), NOT a pino transport: no worker
    // thread, so it is safe under bundlers and short-lived processes — the same
    // reason `logger.ts` avoids transports. `mkdir` creates the parent dir.
    const destination = pinoDestination({
      dest: env.AI_DEBUG_TRANSCRIPT_FILE,
      mkdir: true,
      append: true,
      sync: false,
    });
    // `base: null` drops pid/hostname/service noise — the transcript is a clean
    // event stream. `trace` so nothing is filtered by the app's LOG_LEVEL.
    sink = pino({ base: null, level: 'trace' }, destination);
    getLogger({ module: 'ai-transcript' }).info(
      { file: env.AI_DEBUG_TRANSCRIPT_FILE },
      'AI debug transcript enabled',
    );
  } catch (cause) {
    // An unreadable env or a read-only FS (e.g. serverless) must not take the
    // request down — disable and move on. The interaction still happens; it just
    // is not transcribed. `getLogger` itself reads env, so guard it too.
    try {
      getLogger({ module: 'ai-transcript' }).error(
        { err: cause },
        'AI debug transcript unavailable; disabling',
      );
    } catch {
      /* env unreadable — nothing we can safely log to; stay silent. */
    }
    sink = null;
  }
  return sink;
}

/** Whether the transcript is enabled — cheap, so callers can skip building payloads. */
export function isAiTranscriptEnabled(): boolean {
  return transcriptSink() !== null;
}

/**
 * Append one AI interaction to the local debug transcript. No-op unless
 * `AI_DEBUG_TRANSCRIPT=true`. The active correlation/tenant/user/serial context is
 * stamped on every line so a transcript entry ties back to the request that caused
 * it. Never throws — a logging failure must not fail the request.
 */
export function recordAiInteraction(entry: AiInteraction): void {
  const log = transcriptSink();
  if (!log) return;
  const ctx = getContext();
  log.info(
    {
      ...(ctx
        ? {
            correlationId: ctx.correlationId,
            ...(ctx.tenantId ? { tenantId: ctx.tenantId } : {}),
            ...(ctx.userId ? { userId: ctx.userId } : {}),
            ...(ctx.serialId ? { serialId: ctx.serialId } : {}),
          }
        : {}),
      ...entry,
    },
    `ai:${entry.provider}:${entry.capability}`,
  );
}

/** Test-only: reset the memoized transcript sink (mirrors `resetEnvCache`). */
export function resetAiTranscript(): void {
  sink = undefined;
}
