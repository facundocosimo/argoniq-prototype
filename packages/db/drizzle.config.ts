import { defineConfig } from 'drizzle-kit';
import { getEnv } from '@argoniq/core-domain/env';

/**
 * drizzle-kit config. Migrations are generated from the TS schema (single source
 * of truth) into `./migrations`, then applied by `src/migrate.ts` which also
 * applies the programmatic RLS policies. Schema changes:
 *   pnpm --filter @argoniq/db db:generate   # generate SQL from schema
 *   pnpm db:migrate                               # apply + (re)assert RLS
 */
const env = getEnv();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  // The migration role owns the schema; the app role is least-privilege (no BYPASSRLS).
  dbCredentials: { url: env.DATABASE_MIGRATION_URL ?? env.DATABASE_URL },
  strict: true,
  verbose: true,
});
