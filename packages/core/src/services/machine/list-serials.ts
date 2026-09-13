import { and, desc, eq, lt, or, type SQL } from 'drizzle-orm';
import { type z } from 'zod';
import { CompanyId, roleSpaceOf } from '@argoniq/core-domain';
import { CursorPaginationInput, type Page } from '@argoniq/contracts';
import { type SerialRow, serials } from '@argoniq/db';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { decodeCursor, toPage } from '../../pagination.js';

export const ListSerialsInput = CursorPaginationInput.extend({
  companyId: CompanyId.optional(),
});
export type ListSerialsInput = z.infer<typeof ListSerialsInput>;

/** List serials, newest first. Companies are hard-scoped to their own. */
export async function listSerials(ctx: ServiceContext, input: unknown): Promise<Page<SerialRow>> {
  const { cursor, limit, companyId } = parseInput(ListSerialsInput, input);
  ctx.policy.assertCan('read', 'Serial');

  const isCustomer = roleSpaceOf(ctx.actor.role) === 'customer';
  // A customer with no customer scope is misconfigured — default-deny (empty).
  if (isCustomer && !ctx.actor.companyId) {
    return { items: [], pageInfo: { hasMore: false, nextCursor: null } };
  }
  const scopedCompanyId = isCustomer ? ctx.actor.companyId : companyId;
  const keyset = cursor ? decodeCursor(cursor) : null;

  const rows = await ctx.withTenant(async (tx) => {
    const conditions: SQL[] = [];
    if (scopedCompanyId) conditions.push(eq(serials.companyId, scopedCompanyId));
    if (keyset) {
      conditions.push(
        or(
          lt(serials.createdAt, keyset.createdAt),
          and(eq(serials.createdAt, keyset.createdAt), lt(serials.id, keyset.id)),
        )!,
      );
    }
    return tx
      .select()
      .from(serials)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(serials.createdAt), desc(serials.id))
      .limit(limit + 1);
  });

  return toPage(rows, limit, (row) => ({ createdAt: row.createdAt, id: row.id }));
}
