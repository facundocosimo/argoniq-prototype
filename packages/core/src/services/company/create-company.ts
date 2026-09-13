import { CompanyCreateInput } from '@argoniq/core-domain';
import { type CompanyRow, companies } from '@argoniq/db';
import { InternalError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

/**
 * Create a company. validate → authorize → act → audit. The write runs in the
 * actor's tenant scope (RLS), so the row can only ever land in their tenant, and
 * the policy engine (`create Company`, an OEM-staff-only grant) gates it — a
 * company actor is denied.
 */
export async function createCompany(ctx: ServiceContext, input: unknown): Promise<CompanyRow> {
  const data = parseInput(CompanyCreateInput, input);
  ctx.policy.assertCan('create', 'Company');

  const row = await ctx.withTenant(async (tx) => {
    const [created] = await tx
      .insert(companies)
      .values({ tenantId: ctx.tenantId, name: data.name })
      .returning();
    return created;
  });
  if (!row) throw new InternalError('company insert returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'company.created',
    subjectType: 'Company',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ companyId: row.id }, 'company created');
  return row;
}
