import { and, desc, eq, lt, or, type SQL } from 'drizzle-orm';
import { CursorPaginationInput, type Page } from '@argoniq/contracts';
import { roleSpaceOf } from '@argoniq/core-domain';
import { type CompanyRow, companies } from '@argoniq/db';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { decodeCursor, toPage } from '../../pagination.js';

export const ListCompaniesInput = CursorPaginationInput;
export type ListCompaniesInput = typeof ListCompaniesInput;

/**
 * List companies in the tenant, newest first. Reading the company registry is an
 * OEM-staff capability (the company role space is never granted `read Company`),
 * so a company actor is denied by the policy engine here.
 */
export async function listCompanies(
  ctx: ServiceContext,
  input: unknown,
): Promise<Page<CompanyRow>> {
  const { cursor, limit } = parseInput(ListCompaniesInput, input);
  ctx.policy.assertCan('read', 'Company');
  // Defense in depth: only OEM staff may enumerate the company registry.
  if (roleSpaceOf(ctx.actor.role) !== 'oem_staff') {
    return { items: [], pageInfo: { hasMore: false, nextCursor: null } };
  }
  const keyset = cursor ? decodeCursor(cursor) : null;

  const rows = await ctx.withTenant(async (tx) => {
    const conditions: SQL[] = [];
    if (keyset) {
      conditions.push(
        or(
          lt(companies.createdAt, keyset.createdAt),
          and(eq(companies.createdAt, keyset.createdAt), lt(companies.id, keyset.id)),
        )!,
      );
    }
    return tx
      .select()
      .from(companies)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(companies.createdAt), desc(companies.id))
      .limit(limit + 1);
  });

  return toPage(rows, limit, (row) => ({ createdAt: row.createdAt, id: row.id }));
}
