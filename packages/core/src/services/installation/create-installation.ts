import { eq } from 'drizzle-orm';
import { InstallationCreateInput } from '@argoniq/core-domain';
import { companies, type InstallationRow, installations, sites } from '@argoniq/db';
import { InternalError, NotFoundError, ValidationError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { withUniqueConflict } from '../db-errors.js';

/**
 * Create an installation (a line/cell). The customer + site must resolve within the
 * tenant, and the site must belong to that same customer — a line groups one
 * customer's equipment at one location. Tenant-scoped, OEM-staff only (via policy).
 */
export async function createInstallation(
  ctx: ServiceContext,
  input: unknown,
): Promise<InstallationRow> {
  const data = parseInput(InstallationCreateInput, input);
  ctx.policy.assertCan('create', 'Serial', { companyId: data.companyId });

  const row = await withUniqueConflict('A line with that key already exists.', () =>
    ctx.withTenant(async (tx) => {
      const [company] = await tx
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.id, data.companyId))
        .limit(1);
      if (!company) throw new NotFoundError('company', data.companyId);

      const [site] = await tx
        .select({ id: sites.id, companyId: sites.companyId })
        .from(sites)
        .where(eq(sites.id, data.siteId))
        .limit(1);
      if (!site) throw new NotFoundError('site', data.siteId);
      if (site.companyId !== data.companyId) {
        throw new ValidationError('The selected site belongs to a different company.');
      }

      const [created] = await tx
        .insert(installations)
        .values({
          tenantId: ctx.tenantId,
          companyId: data.companyId,
          siteId: data.siteId,
          kind: data.kind,
          key: data.key,
          name: data.name,
          description: data.description ?? null,
          commissionedAt: data.commissionedAt ?? null,
          warrantyExpiresAt: data.warrantyExpiresAt ?? null,
          status: data.status,
        })
        .returning();
      return created;
    }),
  );
  if (!row) throw new InternalError('installation insert returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'installation.created',
    subjectType: 'Serial',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ installationId: row.id, companyId: row.companyId }, 'installation created');
  return row;
}
