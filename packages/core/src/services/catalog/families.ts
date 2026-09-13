import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  MachineFamilyId,
  MachineFamilyCreateInput,
  MachineFamilyDeleteInput,
  MachineFamilyUpdateInput,
} from '@argoniq/core-domain';
import { type MachineFamilyRow, machineFamilies, machineModels } from '@argoniq/db';
import { ConflictError, InternalError, NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { withReferenceConflict, withUniqueConflict } from '../db-errors.js';

/**
 * Machine families — the top of the product/type catalog (Catalog Studio). A family
 * is the unit at which knowledge is authored once; models, axes, options and
 * playbooks all hang off it. Reads are an OEM-staff capability (`read Catalog` — every
 * staffer, so serial-create pickers work); authoring (`create/update/delete Catalog`)
 * is granted only to tenant admins via `manage all`. All writes run in the actor's
 * tenant scope (RLS) and are audited.
 */
const CATALOG_LIMIT = 200;

export async function listMachineFamilies(ctx: ServiceContext): Promise<MachineFamilyRow[]> {
  ctx.policy.assertCan('read', 'Catalog');
  return ctx.withTenant((tx) =>
    tx.select().from(machineFamilies).orderBy(asc(machineFamilies.name)).limit(CATALOG_LIMIT),
  );
}

export const GetFamilyInput = z.object({ familyId: MachineFamilyId });
export type GetFamilyInput = z.infer<typeof GetFamilyInput>;

/** Read one family (Catalog Studio edit page). OEM-staff. */
export async function getMachineFamily(
  ctx: ServiceContext,
  input: unknown,
): Promise<MachineFamilyRow> {
  const { familyId } = parseInput(GetFamilyInput, input);
  ctx.policy.assertCan('read', 'Catalog');
  const [row] = await ctx.withTenant((tx) =>
    tx.select().from(machineFamilies).where(eq(machineFamilies.id, familyId)).limit(1),
  );
  if (!row) throw new NotFoundError('family', familyId);
  return row;
}

/** Create a family. OEM admin; unique on (tenant, key). */
export async function createMachineFamily(
  ctx: ServiceContext,
  input: unknown,
): Promise<MachineFamilyRow> {
  const data = parseInput(MachineFamilyCreateInput, input);
  ctx.policy.assertCan('create', 'Catalog');

  const row = await withUniqueConflict('A family with that key already exists.', () =>
    ctx.withTenant(async (tx) => {
      const [created] = await tx
        .insert(machineFamilies)
        .values({
          tenantId: ctx.tenantId,
          key: data.key,
          name: data.name,
          description: data.description ?? null,
          iconKey: data.iconKey,
        })
        .returning();
      return created;
    }),
  );
  if (!row) throw new InternalError('machine family insert returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'machine_family.created',
    subjectType: 'Catalog',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ familyId: row.id }, 'machine family created');
  return row;
}

/** Update a family's display fields. `key` is fixed. */
export async function updateMachineFamily(
  ctx: ServiceContext,
  input: unknown,
): Promise<MachineFamilyRow> {
  const data = parseInput(MachineFamilyUpdateInput, input);
  ctx.policy.assertCan('update', 'Catalog');

  const row = await ctx.withTenant(async (tx) => {
    const [existing] = await tx
      .select({ id: machineFamilies.id })
      .from(machineFamilies)
      .where(eq(machineFamilies.id, data.id))
      .limit(1);
    if (!existing) throw new NotFoundError('family', data.id);
    const [updated] = await tx
      .update(machineFamilies)
      .set({
        name: data.name,
        description: data.description ?? null,
        iconKey: data.iconKey,
        updatedAt: new Date(),
      })
      .where(eq(machineFamilies.id, data.id))
      .returning();
    return updated;
  });
  if (!row) throw new InternalError('machine family update returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'machine_family.updated',
    subjectType: 'Catalog',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ familyId: row.id }, 'machine family updated');
  return row;
}

/**
 * Delete a family only when models and document applicability no longer reference
 * it. The database preserves those references; expose a clear conflict to the user.
 */
export async function deleteMachineFamily(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: MachineFamilyId }> {
  const { id } = parseInput(MachineFamilyDeleteInput, input);
  ctx.policy.assertCan('delete', 'Catalog');

  await withReferenceConflict(
    'This family has linked models, machines or documents and cannot be deleted.',
    () =>
      ctx.withTenant(async (tx) => {
        const [existing] = await tx
          .select({ id: machineFamilies.id })
          .from(machineFamilies)
          .where(eq(machineFamilies.id, id))
          .limit(1);
        if (!existing) throw new NotFoundError('family', id);
        const [child] = await tx
          .select({ id: machineModels.id })
          .from(machineModels)
          .where(eq(machineModels.familyId, id))
          .limit(1);
        if (child) throw new ConflictError('This family still has models. Delete them first.');
        await tx.delete(machineFamilies).where(eq(machineFamilies.id, id));
      }),
  );

  ctx.auditor.record({
    kind: 'access',
    action: 'machine_family.deleted',
    subjectType: 'Catalog',
    subjectId: id,
    decision: 'allow',
  });
  ctx.logger.info({ familyId: id }, 'machine family deleted');
  return { id };
}
