import { eq } from 'drizzle-orm';
import { InstallationUpdateInput } from '@argoniq/core-domain';
import { type InstallationRow, installations, sites } from '@argoniq/db';
import { InternalError, NotFoundError, ValidationError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

/**
 * Update a line's mutable facts (site within the same customer, kind, name,
 * description, dates, status). Company and key are identity and are not editable.
 */
export async function updateInstallation(
  ctx: ServiceContext,
  input: unknown,
): Promise<InstallationRow> {
  const data = parseInput(InstallationUpdateInput, input);
  ctx.policy.assertCan('update', 'Serial', { id: data.id });

  const row = await ctx.withTenant(async (tx) => {
    const [existing] = await tx
      .select()
      .from(installations)
      .where(eq(installations.id, data.id))
      .limit(1);
    if (!existing) throw new NotFoundError('installation', data.id);

    const [site] = await tx
      .select({ id: sites.id, companyId: sites.companyId })
      .from(sites)
      .where(eq(sites.id, data.siteId))
      .limit(1);
    if (!site) throw new NotFoundError('site', data.siteId);
    if (site.companyId !== existing.companyId) {
      throw new ValidationError('The selected site belongs to a different company.');
    }

    const [updated] = await tx
      .update(installations)
      .set({
        siteId: data.siteId,
        kind: data.kind,
        name: data.name,
        description: data.description ?? null,
        commissionedAt: data.commissionedAt ?? null,
        warrantyExpiresAt: data.warrantyExpiresAt ?? null,
        status: data.status,
        updatedAt: new Date(),
      })
      .where(eq(installations.id, data.id))
      .returning();
    return updated;
  });
  if (!row) throw new InternalError('installation update returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'installation.updated',
    subjectType: 'Serial',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ installationId: row.id }, 'installation updated');
  return row;
}
