import { and, desc, eq, lt, or, type SQL } from 'drizzle-orm';
import { CursorPaginationInput, type Page } from '@argoniq/contracts';
import { CompanyId, roleSpaceOf } from '@argoniq/core-domain';
import { type SiteRow, sites } from '@argoniq/db';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { decodeCursor, toPage } from '../../pagination.js';

export const ListSitesInput = CursorPaginationInput.extend({
  companyId: CompanyId.optional(),
});
export type ListSitesInput = typeof ListSitesInput;

/**
 * List sites, newest first, optionally filtered to one customer. Company actors
 * are hard-scoped to their own customer (the policy engine grants them
 * `read Site` only for their own); OEM staff see the whole tenant.
 */
export async function listSites(ctx: ServiceContext, input: unknown): Promise<Page<SiteRow>> {
  const { cursor, limit, companyId } = parseInput(ListSitesInput, input);
  ctx.policy.assertCan('read', 'Site');

  const isCustomer = roleSpaceOf(ctx.actor.role) === 'customer';
  if (isCustomer && !ctx.actor.companyId) {
    return { items: [], pageInfo: { hasMore: false, nextCursor: null } };
  }
  const scopedCompanyId = isCustomer ? ctx.actor.companyId : companyId;
  const keyset = cursor ? decodeCursor(cursor) : null;

  const rows = await ctx.withTenant(async (tx) => {
    const conditions: SQL[] = [];
    if (scopedCompanyId) conditions.push(eq(sites.companyId, scopedCompanyId));
    if (keyset) {
      conditions.push(
        or(
          lt(sites.createdAt, keyset.createdAt),
          and(eq(sites.createdAt, keyset.createdAt), lt(sites.id, keyset.id)),
        )!,
      );
    }
    return tx
      .select()
      .from(sites)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(sites.createdAt), desc(sites.id))
      .limit(limit + 1);
  });

  return toPage(rows, limit, (row) => ({ createdAt: row.createdAt, id: row.id }));
}
