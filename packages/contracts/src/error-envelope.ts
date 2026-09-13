import { z } from 'zod';

/**
 * Canonical, transport-agnostic error codes. Adapters map each to their own
 * status (tRPC code, HTTP status). The set is intentionally small and stable;
 * the safety/governance codes (`UNSAFE_REQUEST`, `GROUNDING_FAILED`,
 * `TENANT_ISOLATION`) are first-class because they are product behavior, not
 * incidental failures.
 */
export const ERROR_CODES = [
  'VALIDATION',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'UNSAFE_REQUEST',
  'GROUNDING_FAILED',
  'TENANT_ISOLATION',
  'INTERNAL',
] as const;

export const ErrorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;

/**
 * The serializable error shape sent to clients. `details` is a SAFE, structured
 * payload (e.g. zod field issues) — it must never contain internal reasoning,
 * secrets, or PII. The full diagnostic context lives in the audit log, keyed by
 * `correlationId`.
 */
export const ErrorEnvelope = z.object({
  code: ErrorCode,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  correlationId: z.string().optional(),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;
