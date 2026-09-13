import { z } from 'zod';

/**
 * Centralized, validated environment configuration (12-factor).
 *
 * This is the one place allowed to read `process.env`. Everything else imports
 * the typed, validated `Env` via `getEnv` — never raw `process.env`, so config
 * is trustworthy and a misconfiguration fails fast at boot rather than at the
 * first request. Exposed on the `@argoniq/core-domain/env` subpath only, so
 * pure type consumers (and client bundles) never pull Node config in.
 */
const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url(),
  ALLOWED_ORIGINS: csv.prefault('http://localhost:3000'),

  DATABASE_URL: z.string().url(),
  DATABASE_MIGRATION_URL: z.string().url().optional(),

  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  AUTH_SMTP_URL: z.string().url().optional(),
  AUTH_EMAIL_FROM: z.string().email().optional(),
  AUTH_TRUST_HOST: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** Development-only demo personas. Production always rejects these cookies. */
  DEMO_AUTH_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  /** Live models are selected explicitly; fake mode is only for offline fixtures/tests. */
  AI_MODE: z.enum(['live', 'fake']).default('live'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_GATEWAY_API_KEY: z.string().optional(),
  AI_MODEL_CLASSIFY: z
    .string()
    .regex(/^(openai|anthropic|gateway):.+$/)
    .default('gateway:openai/gpt-5.6-sol'),
  AI_MODEL_ANSWER: z
    .string()
    .regex(/^(openai|anthropic|gateway):.+$/)
    .default('gateway:openai/gpt-5.6-sol'),
  AI_MODEL_REASON: z
    .string()
    .regex(/^(openai|anthropic|gateway):.+$/)
    .default('gateway:openai/gpt-5.6-sol'),
  AI_EMBEDDING_MODEL: z
    .string()
    .regex(/^(openai|gateway):.+$/)
    .default('gateway:openai/text-embedding-3-small'),
  AI_REASONING_EFFORT: z.enum(['none', 'low', 'medium', 'high', 'xhigh', 'max']).default('low'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(60000),

  /** Server-only routing entries; see notifications README. Never return credentials to clients. */
  SUPPORT_ROUTES: z.string().default('[]'),
  SUPPORT_EMAIL_API_KEY: z.string().optional(),
  SUPPORT_EMAIL_FROM: z.email().optional(),

  PGBOSS_DATABASE_URL: z.string().url().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /**
   * Local AI debug transcript. When `true`, every provider interaction (full prompt,
   * payload, response, token usage, latency, errors) is appended to a local JSONL
   * file for debugging. OFF by default — it writes PII/customer text to disk, so keep
   * it `false` in production and enable it only for local debugging.
   */
  AI_DEBUG_TRANSCRIPT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** Where the AI debug transcript is written (JSONL, appended) when enabled. */
  AI_DEBUG_TRANSCRIPT_FILE: z.string().default('.ai-debug/transcript.jsonl'),
  SENTRY_DSN: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default('argoniq'),

  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  /** Root dir for the local-disk StoragePort (dev). Ignored once an S3/R2 bucket is set. */
  STORAGE_LOCAL_ROOT: z.string().default('.storage'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/**
 * Parse and cache the environment. Throws a readable, aggregated error on the
 * first invalid/missing variable. Call once at server boot to fail fast.
 *
 * @param source - the raw environment (defaults to `process.env`); injectable for tests.
 */
export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test-only: reset the memoized environment. */
export function resetEnvCache(): void {
  cached = undefined;
}
