import { and, eq } from 'drizzle-orm';
import { type TenantTransaction, contacts, companies, sites } from '@argoniq/db';
import { NotFoundError } from '@argoniq/observability';

/**
 * Shared invariants for the contact write services (create + update), kept in one
 * place so both enforce them identically. Ids are plain strings here — the branded
 * ids from the DTOs and the (unbranded) ids off a loaded row both satisfy that.
 */

/** The parent customer must resolve within the actor's tenant (RLS already hides other
 *  tenants) — turns a dangling reference into a clean 404 instead of an FK error. */
export async function assertCompanyExists(tx: TenantTransaction, companyId: string): Promise<void> {
  const [row] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!row) throw new NotFoundError('company', companyId);
}

/** A contact's site (when set) must belong to the same customer — a person can only be
 *  based at one of their own customer's locations. */
export async function assertSiteInCompany(
  tx: TenantTransaction,
  siteId: string,
  companyId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.companyId, companyId)))
    .limit(1);
  if (!row) throw new NotFoundError('site', siteId);
}

/** Clear the primary flag across a customer's contacts. The primary is single, so setting
 *  a new one first unsets any current holder (Salesforce-style primary contact). */
export async function clearPrimary(tx: TenantTransaction, companyId: string): Promise<void> {
  await tx
    .update(contacts)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(and(eq(contacts.companyId, companyId), eq(contacts.isPrimary, true)));
}
