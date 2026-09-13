import { eq } from 'drizzle-orm';
import { SiteUpdateInput } from '@argoniq/core-domain';
import { type SiteRow, sites } from '@argoniq/db';
import { InternalError, NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

/** Update a site's mutable facts (name/country/timezone). Its customer is fixed. */
export async function updateSite(ctx: ServiceContext, input: unknown): Promise<SiteRow> {
  const data = parseInput(SiteUpdateInput, input);
  ctx.policy.assertCan('update', 'Site', { id: data.id });

  const row = await ctx.withTenant(async (tx) => {
    const [existing] = await tx.select().from(sites).where(eq(sites.id, data.id)).limit(1);
    if (!existing) throw new NotFoundError('site', data.id);
    const [updated] = await tx
      .update(sites)
      .set({
        name: data.name,
        countryCode: data.countryCode ?? null,
        timezone: data.timezone ?? null,
        updatedAt: new Date(),
      })
      .where(eq(sites.id, data.id))
      .returning();
    return updated;
  });
  if (!row) throw new InternalError('site update returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'site.updated',
    subjectType: 'Site',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ siteId: row.id }, 'site updated');
  return row;
}
