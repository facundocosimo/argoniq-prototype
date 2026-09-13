import { TenantCreateInput } from '@argoniq/core-domain';
import { type TenantRow, tenants } from '@argoniq/db';
import { InternalError } from '@argoniq/observability';
import { type PlatformContext } from '../../platform-context.js';
import { parseInput } from '../../service.js';
import { withUniqueConflict } from '../db-errors.js';

/**
 * Onboard a new Manufacturer (platform operator only). validate → act → audit. There
 * is no tenant policy check here because the platform operator is the super-admin
 * and this is the only surface that writes the un-RLS'd `tenants` table; the
 * transport (`platformProcedure`) is the structural gate. A duplicate slug surfaces
 * as a clean conflict. The new tenant is immediately enterable via impersonation.
 */
export async function createTenant(ctx: PlatformContext, input: unknown): Promise<TenantRow> {
  const data = parseInput(TenantCreateInput, input);

  const row = await withUniqueConflict('An OEM with that slug already exists.', async () => {
    const [created] = await ctx.db
      .insert(tenants)
      .values({
        name: data.name,
        slug: data.slug,
        ...(data.region ? { region: data.region } : {}),
        ...(data.brandAccentColor ? { brandAccentColor: data.brandAccentColor } : {}),
      })
      .returning();
    return created;
  });
  if (!row) throw new InternalError('tenant insert returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'tenant.created',
    subjectType: 'Tenant',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ tenantId: row.id, slug: row.slug }, 'Manufacturer onboarded');
  return row;
}
