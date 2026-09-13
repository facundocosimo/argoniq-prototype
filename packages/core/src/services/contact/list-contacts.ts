import { and, desc, eq, lt, or, type SQL } from 'drizzle-orm';
import { CursorPaginationInput, type Page } from '@argoniq/contracts';
import { CompanyId, SiteId, roleSpaceOf } from '@argoniq/core-domain';
import { type ContactRow, contacts } from '@argoniq/db';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { decodeCursor, toPage } from '../../pagination.js';

export const ListContactsInput = CursorPaginationInput.extend({
  companyId: CompanyId.optional(),
  siteId: SiteId.optional(),
});
export type ListContactsInput = typeof ListContactsInput;

/**
 * List contacts, newest first, optionally filtered to one customer and/or one site.
 * Company actors are hard-scoped to their own customer (mirrors list-sites); OEM staff
 * see the whole tenant. Ordering stays (createdAt, id) to match the keyset cursor — the
 * UI floats the primary contact to the top of the page it renders.
 */
export async function listContacts(ctx: ServiceContext, input: unknown): Promise<Page<ContactRow>> {
  const { cursor, limit, companyId, siteId } = parseInput(ListContactsInput, input);
  ctx.policy.assertCan('read', 'Contact');

  const isCustomer = roleSpaceOf(ctx.actor.role) === 'customer';
  if (isCustomer && !ctx.actor.companyId) {
    return { items: [], pageInfo: { hasMore: false, nextCursor: null } };
  }
  const scopedCompanyId = isCustomer ? ctx.actor.companyId : companyId;
  const keyset = cursor ? decodeCursor(cursor) : null;

  const rows = await ctx.withTenant(async (tx) => {
    const conditions: SQL[] = [];
    if (scopedCompanyId) conditions.push(eq(contacts.companyId, scopedCompanyId));
    if (siteId) conditions.push(eq(contacts.siteId, siteId));
    if (keyset) {
      conditions.push(
        or(
          lt(contacts.createdAt, keyset.createdAt),
          and(eq(contacts.createdAt, keyset.createdAt), lt(contacts.id, keyset.id)),
        )!,
      );
    }
    return tx
      .select()
      .from(contacts)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(contacts.createdAt), desc(contacts.id))
      .limit(limit + 1);
  });

  return toPage(rows, limit, (row) => ({ createdAt: row.createdAt, id: row.id }));
}
