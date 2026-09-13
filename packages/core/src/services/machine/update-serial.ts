import { eq } from 'drizzle-orm';
import { SerialUpdateInput } from '@argoniq/core-domain';
import { type SerialRow, serials, sites, variantAxes } from '@argoniq/db';
import { InternalError, NotFoundError, ValidationError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { withUniqueConflict } from '../db-errors.js';
import { assertOptionValuesValid } from './option-values.js';

/**
 * Update an installed machine's mutable facts (site, serial number, firmware,
 * status, resolved option values). Company/family/model are the machine's fixed
 * identity and are not editable here. A moved site must still belong to the
 * serial's own customer, and option values are re-validated against the serial's
 * (unchanged) model axes.
 */
export async function updateSerial(ctx: ServiceContext, input: unknown): Promise<SerialRow> {
  const data = parseInput(SerialUpdateInput, input);
  ctx.policy.assertCan('update', 'Serial', { id: data.id });

  const row = await withUniqueConflict('A machine with that serial number already exists.', () =>
    ctx.withTenant(async (tx) => {
      const [existing] = await tx.select().from(serials).where(eq(serials.id, data.id)).limit(1);
      if (!existing) throw new NotFoundError('serial', data.id);

      const [site] = await tx
        .select({ id: sites.id, companyId: sites.companyId })
        .from(sites)
        .where(eq(sites.id, data.siteId))
        .limit(1);
      if (!site) throw new NotFoundError('site', data.siteId);
      if (site.companyId !== existing.companyId) {
        throw new ValidationError('The selected site belongs to a different company.');
      }

      const axes = await tx
        .select()
        .from(variantAxes)
        .where(eq(variantAxes.modelId, existing.modelId));
      assertOptionValuesValid(axes, data.optionValues);

      const [updated] = await tx
        .update(serials)
        .set({
          siteId: data.siteId,
          serialNumber: data.serialNumber,
          optionValues: data.optionValues,
          firmwareVersion: data.firmwareVersion ?? null,
          status: data.status,
          updatedAt: new Date(),
        })
        .where(eq(serials.id, data.id))
        .returning();
      return updated;
    }),
  );
  if (!row) throw new InternalError('serial update returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'serial.updated',
    subjectType: 'Serial',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ serialId: row.id }, 'serial updated');
  return row;
}
