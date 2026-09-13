/* eslint-disable no-restricted-globals -- CLI entrypoint: legitimately reads env at boot and sets the process exit code. */
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { getEnv } from '@argoniq/core-domain/env';
import { getLogger } from '@argoniq/observability';
import {
  applyKnowledgeTierIsolation,
  applyRlsPolicies,
  applySearchIndexes,
  applyVectorExtension,
} from './rls.js';

/** The role embedded in a Postgres connection string (decoded), or '' if absent. */
function roleOf(connectionString: string): string {
  return decodeURIComponent(new URL(connectionString).username);
}

/**
 * Migration runner (`pnpm db:migrate`). Order matters:
 *   1. enable pgvector (before any `vector` column is created),
 *   2. apply generated table migrations,
 *   3. (re)assert RLS policies + search indexes + T4 tier isolation (idempotent).
 * Runs under the schema-owner role (DATABASE_MIGRATION_URL).
 */
async function main(): Promise<void> {
  const env = getEnv();
  const log = getLogger({ module: 'migrate' });
  const migrationUrl = env.DATABASE_MIGRATION_URL ?? env.DATABASE_URL;
  const client = postgres(migrationUrl, { max: 1 });

  try {
    await applyVectorExtension(client);
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)),
    });
    await applyRlsPolicies(client);
    await applySearchIndexes(client);

    // T4 credential isolation binds to the least-privilege APP role. It only makes
    // sense when that role differs from the schema owner running migrations; a
    // single-role dev setup logs and skips (the retriever's in-SQL filter still holds).
    const appRole = roleOf(env.DATABASE_URL);
    const migrationRole = roleOf(migrationUrl);
    if (appRole && appRole !== migrationRole) {
      await applyKnowledgeTierIsolation(client, appRole);
      log.info({ appRole }, 'migrations applied; RLS + search indexes + T4 isolation asserted');
    } else {
      log.warn(
        { appRole, migrationRole },
        'migrations applied; T4 tier-isolation policy SKIPPED (app and migration share a role)',
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  getLogger({ module: 'migrate' }).error({ err: error }, 'migration failed');
  process.exitCode = 1;
});
