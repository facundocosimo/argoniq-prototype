import { pino, type Logger as PinoLogger } from 'pino';
import { getEnv } from '@argoniq/core-domain/env';
import { getContext } from './context.js';

export type Logger = PinoLogger;

/**
 * Paths that are scrubbed before anything is written. **Never log secrets or
 * PII** (SECURITY.md); this is the backstop if a caller forgets.
 */
const REDACT_PATHS = [
  '*.password',
  '*.token',
  '*.secret',
  '*.apiKey',
  '*.authorization',
  'password',
  'token',
  'secret',
  'apiKey',
  'authorization',
  'req.headers.authorization',
  'req.headers.cookie',
];

let root: Logger | undefined;

function rootLogger(): Logger {
  if (root) return root;
  const env = getEnv();
  root = pino({
    level: env.LOG_LEVEL,
    base: { service: env.OTEL_SERVICE_NAME },
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    // Inject the live async request context onto every line.
    mixin() {
      const ctx = getContext();
      if (!ctx) return {};
      return {
        correlationId: ctx.correlationId,
        ...(ctx.tenantId ? { tenantId: ctx.tenantId } : {}),
        ...(ctx.userId ? { userId: ctx.userId } : {}),
        ...(ctx.serialId ? { serialId: ctx.serialId } : {}),
      };
    },
    // Structured JSON to stdout — NO worker-thread transport. pino-pretty's
    // transport spawns a worker that breaks under bundlers (Next) and can hang
    // short-lived CLIs; for human-readable dev logs, pipe through the CLI:
    // `pnpm dev | pnpm exec pino-pretty`.
  });
  return root;
}

/**
 * The one logger. Optionally bind static fields for a sub-component
 * (`getLogger({ module: 'ingestion' })`). Correlation/tenant/user/serial are
 * added automatically from context — do not pass them here.
 */
export function getLogger(bindings?: Record<string, unknown>): Logger {
  return bindings ? rootLogger().child(bindings) : rootLogger();
}
