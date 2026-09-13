import { eq } from 'drizzle-orm';
import { CompanyUpdateInput } from '@argoniq/core-domain';
import { type CompanyRow, companies } from '@argoniq/db';
import { InternalError, NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

/** Update a company's name. RLS scopes the row to the tenant; a missing (or
 *  out-of-scope) row 404s before any write. */
export async function updateCompany(ctx: ServiceContext, input: unknown): Promise<CompanyRow> {
  const data = parseInput(CompanyUpdateInput, input);
  ctx.policy.assertCan('update', 'Company', { id: data.id });

  const row = await ctx.withTenant(async (tx) => {
    const [existing] = await tx.select().from(companies).where(eq(companies.id, data.id)).limit(1);
    if (!existing) throw new NotFoundError('company', data.id);
    const [updated] = await tx
      .update(companies)
      .set({ name: data.name, updatedAt: new Date() })
      .where(eq(companies.id, data.id))
      .returning();
    return updated;
  });
  if (!row) throw new InternalError('company update returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'company.updated',
    subjectType: 'Company',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ companyId: row.id }, 'company updated');
  return row;
}
