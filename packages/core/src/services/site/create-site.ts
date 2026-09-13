import { eq } from 'drizzle-orm';
import { SiteCreateInput } from '@argoniq/core-domain';
import { type SiteRow, companies, sites } from '@argoniq/db';
import { InternalError, NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

/**
 * Create a site under a customer. The parent customer must resolve within the
 * actor's tenant — RLS already hides other tenants' companies, and this explicit
 * existence check turns a dangling reference into a clean 404 instead of a foreign
 * key error. The write itself is tenant-scoped and policy-gated (OEM-staff only).
 */
export async function createSite(ctx: ServiceContext, input: unknown): Promise<SiteRow> {
  const data = parseInput(SiteCreateInput, input);
  ctx.policy.assertCan('create', 'Site', { companyId: data.companyId });

  const row = await ctx.withTenant(async (tx) => {
    const [company] = await tx
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, data.companyId))
      .limit(1);
    if (!company) throw new NotFoundError('company', data.companyId);

    const [created] = await tx
      .insert(sites)
      .values({
        tenantId: ctx.tenantId,
        companyId: data.companyId,
        name: data.name,
        countryCode: data.countryCode ?? null,
        timezone: data.timezone ?? null,
      })
      .returning();
    return created;
  });
  if (!row) throw new InternalError('site insert returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'site.created',
    subjectType: 'Site',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ siteId: row.id, companyId: row.companyId }, 'site created');
  return row;
}
