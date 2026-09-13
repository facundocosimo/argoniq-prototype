import { eq } from 'drizzle-orm';
import { type SiteId, SiteDeleteInput } from '@argoniq/core-domain';
import { sites } from '@argoniq/db';
import { NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { withReferenceConflict } from '../db-errors.js';

/** Delete a site. Serials are `restrict`-bound to their site, so a site with
 *  installed machines cannot be deleted — surfaced as a clean conflict. */
export async function deleteSite(ctx: ServiceContext, input: unknown): Promise<{ id: SiteId }> {
  const { id } = parseInput(SiteDeleteInput, input);
  ctx.policy.assertCan('delete', 'Site', { id });

  await withReferenceConflict('This site still has machines. Remove them first.', () =>
    ctx.withTenant(async (tx) => {
      const [existing] = await tx.select().from(sites).where(eq(sites.id, id)).limit(1);
      if (!existing) throw new NotFoundError('site', id);
      await tx.delete(sites).where(eq(sites.id, id));
    }),
  );

  ctx.auditor.record({
    kind: 'access',
    action: 'site.deleted',
    subjectType: 'Site',
    subjectId: id,
    decision: 'allow',
  });
  ctx.logger.info({ siteId: id }, 'site deleted');
  return { id };
}
