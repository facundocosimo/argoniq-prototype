import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { CompanyId } from '@argoniq/core-domain';
import { type CompanyRow, companies } from '@argoniq/db';
import { NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

export const GetCompanyInput = z.object({ companyId: CompanyId });
export type GetCompanyInput = z.infer<typeof GetCompanyInput>;

/** Read one company (management edit page). Validate → authorize → act. */
export async function getCompany(ctx: ServiceContext, input: unknown): Promise<CompanyRow> {
  const { companyId } = parseInput(GetCompanyInput, input);
  ctx.policy.assertCan('read', 'Company');
  const [row] = await ctx.withTenant((tx) =>
    tx.select().from(companies).where(eq(companies.id, companyId)).limit(1),
  );
  if (!row) throw new NotFoundError('company', companyId);
  return row;
}
