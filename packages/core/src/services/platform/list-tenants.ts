import { asc } from 'drizzle-orm';
import { type TenantRow, tenants } from '@argoniq/db';
import { type PlatformContext } from '../../platform-context.js';

/**
 * List every Manufacturer on the platform. Reads the un-RLS'd `tenants` table
 * directly (no tenant GUC) — this is the one cross-tenant read, and only a
 * `PlatformContext` (super-admin) can reach it. Bounded + ordered for the console.
 */
export async function listTenants(ctx: PlatformContext): Promise<TenantRow[]> {
  return ctx.db.select().from(tenants).orderBy(asc(tenants.name)).limit(500);
}
