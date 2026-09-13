import { and, desc, eq, lt, or, type SQL } from 'drizzle-orm';
import { CursorPaginationInput, type Page } from '@argoniq/contracts';
import { CompanyId, SerialId, type SafetyZone, roleSpaceOf } from '@argoniq/core-domain';
import { type CaseRow, cases } from '@argoniq/db';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { decodeCursor, toPage } from '../../pagination.js';

export const ListCasesInput = CursorPaginationInput.extend({
  companyId: CompanyId.optional(),
  serialId: SerialId.optional(),
});
export type ListCasesInput = typeof ListCasesInput;

/**
 * Customer-facing support case projection. Staff-only notes, numeric cause rankings,
 * and confidence values are omitted by construction.
 */
export type ServiceCaseView = {
  readonly id: string;
  readonly reference: string;
  readonly status: CaseRow['status'];
  readonly summary: string;
  readonly safetyZone: SafetyZone | null;
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
};

export function toCaseView(row: CaseRow): ServiceCaseView {
  return {
    id: row.id,
    reference: `CASE-${row.id.slice(0, 8).toUpperCase()}`,
    status: row.status,
    summary: row.summary,
    safetyZone: row.safetyZone,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  };
}

/**
 * List the actor's Pre-qualified Service Cases, newest first. Companies are
 * hard-scoped to their own customer; OEM staff see the whole tenant. Returns the
 * redacted customer-facing view for every caller (see {@link ServiceCaseView}).
 */
export async function listCases(
  ctx: ServiceContext,
  input: unknown,
): Promise<Page<ServiceCaseView>> {
  const { cursor, limit, companyId, serialId } = parseInput(ListCasesInput, input);
  ctx.policy.assertCan('read', 'Case');

  const isCustomer = roleSpaceOf(ctx.actor.role) === 'customer';
  if (isCustomer && !ctx.actor.companyId) {
    return { items: [], pageInfo: { hasMore: false, nextCursor: null } };
  }
  const keyset = cursor ? decodeCursor(cursor) : null;

  const rows = await ctx.withTenant(async (tx) => {
    const conditions: SQL[] = [];
    if (isCustomer) conditions.push(eq(cases.companyId, ctx.actor.companyId ?? ''));
    else if (companyId) conditions.push(eq(cases.companyId, companyId));
    if (serialId) conditions.push(eq(cases.serialId, serialId));
    if (keyset) {
      conditions.push(
        or(
          lt(cases.createdAt, keyset.createdAt),
          and(eq(cases.createdAt, keyset.createdAt), lt(cases.id, keyset.id)),
        )!,
      );
    }
    return tx
      .select()
      .from(cases)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(cases.createdAt), desc(cases.id))
      .limit(limit + 1);
  });

  return toPage(rows.map(toCaseView), limit, (view) => ({
    createdAt: view.createdAt,
    id: view.id,
  }));
}
