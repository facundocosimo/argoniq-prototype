import { getEnv } from '@argoniq/core-domain/env';

/** Worker runtime configuration, resolved once from validated env. */
export type WorkerConfig = {
  /** Connection string for pg-boss's own queue tables (falls back to the app DB). */
  readonly queueConnectionString: string;
  /** Connection string for the tenant-scoped application database (RLS-enforced). */
  readonly databaseUrl: string;
  /** Root dir for the local-disk StoragePort (dev) — where source PDFs are read from. */
  readonly storageRoot: string;
};

/**
 * Resolve the worker config from env. pg-boss may use a dedicated database
 * (`PGBOSS_DATABASE_URL`) so its queue tables never share a connection pool with the
 * RLS-enforced application data; it falls back to `DATABASE_URL` when unset.
 */
export function getWorkerConfig(): WorkerConfig {
  const env = getEnv();
  return {
    queueConnectionString: env.PGBOSS_DATABASE_URL ?? env.DATABASE_URL,
    databaseUrl: env.DATABASE_URL,
    storageRoot: env.STORAGE_LOCAL_ROOT,
  };
}
