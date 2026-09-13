import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { SiteId } from '@argoniq/core-domain';
import { type SiteRow, sites } from '@argoniq/db';
import { NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

export const GetSiteInput = z.object({ siteId: SiteId });
export type GetSiteInput = z.infer<typeof GetSiteInput>;

/** Read one site (management edit page). Validate → authorize → act. */
export async function getSite(ctx: ServiceContext, input: unknown): Promise<SiteRow> {
  const { siteId } = parseInput(GetSiteInput, input);
  ctx.policy.assertCan('read', 'Site');
  const [row] = await ctx.withTenant((tx) =>
    tx.select().from(sites).where(eq(sites.id, siteId)).limit(1),
  );
  if (!row) throw new NotFoundError('site', siteId);
  return row;
}
