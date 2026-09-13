import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDatabase } from '../client.js';
import { authUsers } from '../schema/auth.js';
import { companies } from '../schema/companies.js';
import { memberships } from '../schema/memberships.js';
import { tenants } from '../schema/tenants.js';

/** Only a verified provider user ID may enter this identity lookup. No tenant is trusted yet. */
export async function listIdentityMemberships(userId: string) {
  return getDatabase().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return tx
      .select({
        tenantId: memberships.tenantId,
        tenantName: tenants.name,
        role: memberships.role,
        companyId: memberships.companyId,
        state: memberships.state,
      })
      .from(memberships)
      .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
      .where(and(eq(memberships.userId, userId), isNull(tenants.suspendedAt)));
  });
}

/** Resolve a verified membership's company under its tenant RLS context.
 * Callers supply stored membership scope, never a browser-selected company ID. */
export async function getMembershipCompany(
  tenantId: string,
  companyId: string,
): Promise<{ id: string; name: string } | null> {
  return getDatabase().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    const [row] = await tx
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId)))
      .limit(1);
    return row ?? null;
  });
}

export async function getIdentityUser(userId: string) {
  const [user] = await getDatabase()
    .select({ isPlatformOperator: authUsers.isPlatformOperator })
    .from(authUsers)
    .where(eq(authUsers.id, userId))
    .limit(1);
  return user ?? null;
}
