import { ConflictError } from '@argoniq/observability';

/**
 * Map Postgres constraint violations onto typed domain errors, so a user-caused
 * conflict (duplicate slug, deleting a machine that still has cases) surfaces as
 * a clean 409 with a helpful message instead of leaking as an opaque 500. We match
 * on the SQLSTATE code carried on the driver error, never on message text.
 */
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const RESTRICT_VIOLATION = '23001';

function sqlStateOf(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  let current = error;
  // Drizzle wraps the driver's SQLSTATE in cause. Never inspect message text or
  // surface the SQL/parameters from that wrapper to users.
  while (typeof current === 'object' && current !== null && !seen.has(current)) {
    seen.add(current);
    const wrapped = current as { code?: unknown; cause?: unknown };
    if (typeof wrapped.code === 'string' && /^[0-9A-Z]{5}$/.test(wrapped.code)) return wrapped.code;
    current = wrapped.cause;
  }
  return undefined;
}

function isUniqueViolation(error: unknown): boolean {
  return sqlStateOf(error) === UNIQUE_VIOLATION;
}

function isForeignKeyViolation(error: unknown): boolean {
  const code = sqlStateOf(error);
  return code === FOREIGN_KEY_VIOLATION || code === RESTRICT_VIOLATION;
}

/** Run a write, translating a unique-constraint hit into a friendly `ConflictError`. */
export async function withUniqueConflict<T>(
  conflictMessage: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError(conflictMessage);
    throw error;
  }
}

/** Translate a reference violation on delete/reassignment into a friendly conflict. */
export async function withReferenceConflict<T>(
  conflictMessage: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isForeignKeyViolation(error)) throw new ConflictError(conflictMessage);
    throw error;
  }
}
