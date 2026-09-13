import { sql } from 'drizzle-orm';
import { type TenantId } from '@argoniq/core-domain';
import { type Database } from './client.js';

/** The transaction handle passed to a tenant-scoped callback. */
export type TenantTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Run `fn` inside a tenant-scoped transaction (the load-bearing
 * isolation primitive). It sets the transaction-local `app.tenant_id` GUC, which
 * every RLS policy keys on, so Postgres itself refuses cross-tenant rows for the
 * duration of the transaction.
 *
 * ALL tenant data access goes through this. A raw query against a tenant-scoped
 * table outside `withTenant` returns zero rows (the GUC is unset → null ≠
 * tenant_id → default-deny), which is safe but a bug — never rely on it.
 */
export async function withTenant<T>(
  db: Database,
  tenantId: TenantId,
  fn: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // `true` => transaction-local; reset automatically at commit/rollback.
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}
