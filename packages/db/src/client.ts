import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { getEnv } from '@argoniq/core-domain/env';
import * as schema from './schema/index.js';

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Create a Database bound to a connection. The application uses the
 * least-privilege role (no BYPASSRLS) so RLS is always in force — see.
 * Pass an explicit connection string only for tests or the migration role.
 */
export function createDatabase(
  connectionString?: string,
): Database & { $client: ReturnType<typeof postgres> } {
  const env = getEnv();
  const client = postgres(connectionString ?? env.DATABASE_URL, {
    max: 10,
    // Fail fast rather than hang a request on a dead pool.
    connect_timeout: 10,
  });
  return drizzle(client, { schema });
}

// Next development reloads server modules. Keep one pool across those reloads so
// repeated edits do not consume every PostgreSQL connection slot.
const developmentGlobal = globalThis as typeof globalThis & {
  argoniqDevelopmentDatabase?: Database;
};
let singleton: Database | undefined;

/** The shared application Database. Lazily created on first use. */
export function getDatabase(): Database {
  if (getEnv().NODE_ENV === 'development') {
    developmentGlobal.argoniqDevelopmentDatabase ??= createDatabase();
    return developmentGlobal.argoniqDevelopmentDatabase;
  }
  singleton ??= createDatabase();
  return singleton;
}
