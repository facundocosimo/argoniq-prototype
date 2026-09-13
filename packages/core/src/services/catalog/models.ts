import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  MachineFamilyId,
  MachineModelId,
  MachineModelCreateInput,
  MachineModelDeleteInput,
  MachineModelUpdateInput,
} from '@argoniq/core-domain';
import { type MachineModelRow, machineFamilies, machineModels } from '@argoniq/db';
import { InternalError, NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { withReferenceConflict, withUniqueConflict } from '../db-errors.js';

/**
 * Machine models — a model within a family (e.g. "Atlas Training Cell"). Carries the
 * variant axes and option catalog a serial is built against. Reads gate on
 * `read Catalog` (all OEM staff, for form pickers); writes on `create/update/delete
 * Catalog` (tenant admins). `familyId` is fixed at create.
 */
const CATALOG_LIMIT = 200;

export const ListMachineModelsInput = z.object({ familyId: MachineFamilyId });
export type ListMachineModelsInput = z.infer<typeof ListMachineModelsInput>;

export async function listMachineModels(
  ctx: ServiceContext,
  input: unknown,
): Promise<MachineModelRow[]> {
  const { familyId } = parseInput(ListMachineModelsInput, input);
  ctx.policy.assertCan('read', 'Catalog');
  return ctx.withTenant((tx) =>
    tx
      .select()
      .from(machineModels)
      .where(eq(machineModels.familyId, familyId))
      .orderBy(asc(machineModels.name))
      .limit(CATALOG_LIMIT),
  );
}

export const GetModelInput = z.object({ modelId: MachineModelId });
export type GetModelInput = z.infer<typeof GetModelInput>;

/** Read one model (Catalog Studio model hub). OEM-staff. */
export async function getMachineModel(
  ctx: ServiceContext,
  input: unknown,
): Promise<MachineModelRow> {
  const { modelId } = parseInput(GetModelInput, input);
  ctx.policy.assertCan('read', 'Catalog');
  const [row] = await ctx.withTenant((tx) =>
    tx.select().from(machineModels).where(eq(machineModels.id, modelId)).limit(1),
  );
  if (!row) throw new NotFoundError('model', modelId);
  return row;
}

/** Create a model under a family. OEM admin; unique on (tenant, key); family must exist. */
export async function createMachineModel(
  ctx: ServiceContext,
  input: unknown,
): Promise<MachineModelRow> {
  const data = parseInput(MachineModelCreateInput, input);
  ctx.policy.assertCan('create', 'Catalog');

  const row = await withUniqueConflict('A model with that key already exists.', () =>
    ctx.withTenant(async (tx) => {
      const [family] = await tx
        .select({ id: machineFamilies.id })
        .from(machineFamilies)
        .where(eq(machineFamilies.id, data.familyId))
        .limit(1);
      if (!family) throw new NotFoundError('family', data.familyId);

      const [created] = await tx
        .insert(machineModels)
        .values({
          tenantId: ctx.tenantId,
          familyId: data.familyId,
          key: data.key,
          name: data.name,
          description: data.description ?? null,
          imageUrl: data.imageUrl,
        })
        .returning();
      return created;
    }),
  );
  if (!row) throw new InternalError('machine model insert returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'machine_model.created',
    subjectType: 'Catalog',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ modelId: row.id, familyId: row.familyId }, 'machine model created');
  return row;
}

/** Update a model's display fields. `familyId` and `key` are fixed. */
export async function updateMachineModel(
  ctx: ServiceContext,
  input: unknown,
): Promise<MachineModelRow> {
  const data = parseInput(MachineModelUpdateInput, input);
  ctx.policy.assertCan('update', 'Catalog');

  const row = await ctx.withTenant(async (tx) => {
    const [existing] = await tx
      .select({ id: machineModels.id })
      .from(machineModels)
      .where(eq(machineModels.id, data.id))
      .limit(1);
    if (!existing) throw new NotFoundError('model', data.id);
    const [updated] = await tx
      .update(machineModels)
      .set({
        name: data.name,
        description: data.description ?? null,
        imageUrl: data.imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(machineModels.id, data.id))
      .returning();
    return updated;
  });
  if (!row) throw new InternalError('machine model update returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'machine_model.updated',
    subjectType: 'Catalog',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ modelId: row.id }, 'machine model updated');
  return row;
}

/**
 * Delete a model. Its variant axes and option catalog cascade (the model's own
 * config), but machines and document applicability are protected references:
 * deleting their model surfaces a clean conflict.
 */
export async function deleteMachineModel(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: MachineModelId }> {
  const { id } = parseInput(MachineModelDeleteInput, input);
  ctx.policy.assertCan('delete', 'Catalog');

  await withReferenceConflict(
    'This model has linked machines or documents and cannot be deleted.',
    () =>
      ctx.withTenant(async (tx) => {
        const [existing] = await tx
          .select({ id: machineModels.id })
          .from(machineModels)
          .where(eq(machineModels.id, id))
          .limit(1);
        if (!existing) throw new NotFoundError('model', id);
        await tx.delete(machineModels).where(eq(machineModels.id, id));
      }),
  );

  ctx.auditor.record({
    kind: 'access',
    action: 'machine_model.deleted',
    subjectType: 'Catalog',
    subjectId: id,
    decision: 'allow',
  });
  ctx.logger.info({ modelId: id }, 'machine model deleted');
  return { id };
}
