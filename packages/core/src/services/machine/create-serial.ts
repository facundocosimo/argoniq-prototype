import { eq } from 'drizzle-orm';
import { SerialCreateInput } from '@argoniq/core-domain';
import {
  type SerialRow,
  companies,
  machineFamilies,
  machineModels,
  serials,
  sites,
  variantAxes,
} from '@argoniq/db';
import { InternalError, NotFoundError, ValidationError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { withUniqueConflict } from '../db-errors.js';
import { assertOptionValuesValid } from './option-values.js';

/**
 * Register an installed machine. Every parent (customer, site, family, model) must
 * resolve within the actor's tenant — RLS enforces that, and the explicit checks
 * turn dangling references into clean 404s. Cross-parent integrity is enforced too:
 * the site must belong to the chosen customer and the model to the chosen family.
 * `optionValues` are validated against the model's variant axes so the serial can
 * never carry configuration its model does not define. Policy-gated (OEM-staff).
 */
export async function createSerial(ctx: ServiceContext, input: unknown): Promise<SerialRow> {
  const data = parseInput(SerialCreateInput, input);
  ctx.policy.assertCan('create', 'Serial', { companyId: data.companyId });

  const row = await withUniqueConflict('A machine with that serial number already exists.', () =>
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

      const [family] = await tx
        .select({ id: machineFamilies.id })
        .from(machineFamilies)
        .where(eq(machineFamilies.id, data.familyId))
        .limit(1);
      if (!family) throw new NotFoundError('machine family', data.familyId);

      const [model] = await tx
        .select({ id: machineModels.id, familyId: machineModels.familyId })
        .from(machineModels)
        .where(eq(machineModels.id, data.modelId))
        .limit(1);
      if (!model) throw new NotFoundError('machine model', data.modelId);
      if (model.familyId !== data.familyId) {
        throw new ValidationError('The selected model belongs to a different family.');
      }

      const axes = await tx.select().from(variantAxes).where(eq(variantAxes.modelId, data.modelId));
      assertOptionValuesValid(axes, data.optionValues);

      const [created] = await tx
        .insert(serials)
        .values({
          tenantId: ctx.tenantId,
          companyId: data.companyId,
          siteId: data.siteId,
          familyId: data.familyId,
          modelId: data.modelId,
          serialNumber: data.serialNumber,
          optionValues: data.optionValues,
          firmwareVersion: data.firmwareVersion ?? null,
          status: data.status,
        })
        .returning();
      return created;
    }),
  );
  if (!row) throw new InternalError('serial insert returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'serial.created',
    subjectType: 'Serial',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ serialId: row.id, companyId: row.companyId }, 'serial created');
  return row;
}
