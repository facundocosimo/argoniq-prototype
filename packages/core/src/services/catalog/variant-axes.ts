import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  MachineModelId,
  VariantId,
  VariantAxisCreateInput,
  VariantAxisDeleteInput,
  VariantAxisUpdateInput,
} from '@argoniq/core-domain';
import { type VariantAxisRow, machineModels, variantAxes } from '@argoniq/db';
import { InternalError, NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { withUniqueConflict } from '../db-errors.js';

/**
 * Variant axes — the dimensions along which a model's units differ (profile,
 * material, inert gas…). A serial resolves a value per axis into its EffectiveConfig;
 * `safetyRelevant` axes gate answer modes. Reads gate on `read Catalog`; writes on
 * `create/update/delete Catalog`. `modelId` and `key` are fixed at create (a serial's
 * stored as-built value is keyed by them).
 */
const CATALOG_LIMIT = 200;

export const ListVariantAxesInput = z.object({ modelId: MachineModelId });
export type ListVariantAxesInput = z.infer<typeof ListVariantAxesInput>;

export async function listVariantAxes(
  ctx: ServiceContext,
  input: unknown,
): Promise<VariantAxisRow[]> {
  const { modelId } = parseInput(ListVariantAxesInput, input);
  ctx.policy.assertCan('read', 'Catalog');
  return ctx.withTenant((tx) =>
    tx
      .select()
      .from(variantAxes)
      .where(eq(variantAxes.modelId, modelId))
      .orderBy(asc(variantAxes.label))
      .limit(CATALOG_LIMIT),
  );
}

export const GetVariantAxisInput = z.object({ axisId: VariantId });
export type GetVariantAxisInput = z.infer<typeof GetVariantAxisInput>;

/** Read one variant axis (Catalog Studio axis editor). OEM-staff. */
export async function getVariantAxis(ctx: ServiceContext, input: unknown): Promise<VariantAxisRow> {
  const { axisId } = parseInput(GetVariantAxisInput, input);
  ctx.policy.assertCan('read', 'Catalog');
  const [row] = await ctx.withTenant((tx) =>
    tx.select().from(variantAxes).where(eq(variantAxes.id, axisId)).limit(1),
  );
  if (!row) throw new NotFoundError('variant axis', axisId);
  return row;
}

/** Create a variant axis on a model. OEM admin; unique on (model, key); model must exist. */
export async function createVariantAxis(
  ctx: ServiceContext,
  input: unknown,
): Promise<VariantAxisRow> {
  const data = parseInput(VariantAxisCreateInput, input);
  ctx.policy.assertCan('create', 'Catalog');

  const row = await withUniqueConflict('An axis with that key already exists on this model.', () =>
    ctx.withTenant(async (tx) => {
      const [model] = await tx
        .select({ id: machineModels.id })
        .from(machineModels)
        .where(eq(machineModels.id, data.modelId))
        .limit(1);
      if (!model) throw new NotFoundError('model', data.modelId);

      const [created] = await tx
        .insert(variantAxes)
        .values({
          tenantId: ctx.tenantId,
          modelId: data.modelId,
          key: data.key,
          label: data.label,
          dataType: data.dataType,
          options: data.options ? [...data.options] : null,
          unit: data.unit ?? null,
          safetyRelevant: data.safetyRelevant,
        })
        .returning();
      return created;
    }),
  );
  if (!row) throw new InternalError('variant axis insert returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'variant_axis.created',
    subjectType: 'Catalog',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ axisId: row.id, modelId: row.modelId }, 'variant axis created');
  return row;
}

/** Update a variant axis (label/type/values/unit/safety). `key` is fixed. */
export async function updateVariantAxis(
  ctx: ServiceContext,
  input: unknown,
): Promise<VariantAxisRow> {
  const data = parseInput(VariantAxisUpdateInput, input);
  ctx.policy.assertCan('update', 'Catalog');

  const row = await ctx.withTenant(async (tx) => {
    const [existing] = await tx
      .select({ id: variantAxes.id })
      .from(variantAxes)
      .where(eq(variantAxes.id, data.id))
      .limit(1);
    if (!existing) throw new NotFoundError('variant axis', data.id);
    const [updated] = await tx
      .update(variantAxes)
      .set({
        label: data.label,
        dataType: data.dataType,
        options: data.options ? [...data.options] : null,
        unit: data.unit ?? null,
        safetyRelevant: data.safetyRelevant,
        updatedAt: new Date(),
      })
      .where(eq(variantAxes.id, data.id))
      .returning();
    return updated;
  });
  if (!row) throw new InternalError('variant axis update returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'variant_axis.updated',
    subjectType: 'Catalog',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ axisId: row.id }, 'variant axis updated');
  return row;
}

/**
 * Delete a variant axis. Serials reference an axis only by key inside their
 * `optionValues` JSON (no FK), so a delete is safe — a serial's now-orphaned value is
 * simply ignored by config resolution. Hard delete, no dependents to guard.
 */
export async function deleteVariantAxis(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: VariantId }> {
  const { id } = parseInput(VariantAxisDeleteInput, input);
  ctx.policy.assertCan('delete', 'Catalog');

  await ctx.withTenant(async (tx) => {
    const [existing] = await tx
      .select({ id: variantAxes.id })
      .from(variantAxes)
      .where(eq(variantAxes.id, id))
      .limit(1);
    if (!existing) throw new NotFoundError('variant axis', id);
    await tx.delete(variantAxes).where(eq(variantAxes.id, id));
  });

  ctx.auditor.record({
    kind: 'access',
    action: 'variant_axis.deleted',
    subjectType: 'Catalog',
    subjectId: id,
    decision: 'allow',
  });
  ctx.logger.info({ axisId: id }, 'variant axis deleted');
  return { id };
}
