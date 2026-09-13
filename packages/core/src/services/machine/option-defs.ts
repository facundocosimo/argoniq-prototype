import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  MachineModelId,
  OptionDefId,
  OptionDefCreateInput,
  OptionDefDeleteInput,
  OptionDefUpdateInput,
} from '@argoniq/core-domain';
import { machineModels, type OptionDefRow, optionDefs } from '@argoniq/db';
import { InternalError, NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { withUniqueConflict } from '../db-errors.js';

/**
 * The equipment-option catalog (`OptionDef`) — installable modules a model offers.
 * Part of the product/type catalog, so it shares the `Catalog` authorization subject:
 * every OEM staffer may READ it (it backs the serial option pickers and the model
 * hub), and tenant admins may author it. It lives here, next to the per-serial option
 * selection machinery, rather than in `../catalog`, because the two are edited together.
 */
const CATALOG_LIMIT = 200;

export const ListOptionDefsInput = z.object({ modelId: MachineModelId });
export type ListOptionDefsInput = z.infer<typeof ListOptionDefsInput>;

export const GetOptionDefInput = z.object({ optionDefId: OptionDefId });
export type GetOptionDefInput = z.infer<typeof GetOptionDefInput>;

/** Read one catalog option (model hub option editor). OEM-staff. */
export async function getOptionDef(ctx: ServiceContext, input: unknown): Promise<OptionDefRow> {
  const { optionDefId } = parseInput(GetOptionDefInput, input);
  ctx.policy.assertCan('read', 'Catalog');
  const [row] = await ctx.withTenant((tx) =>
    tx.select().from(optionDefs).where(eq(optionDefs.id, optionDefId)).limit(1),
  );
  if (!row) throw new NotFoundError('option', optionDefId);
  return row;
}

/** List a model's option catalog (form pickers + the model hub). OEM-staff. */
export async function listOptionDefs(ctx: ServiceContext, input: unknown): Promise<OptionDefRow[]> {
  const { modelId } = parseInput(ListOptionDefsInput, input);
  ctx.policy.assertCan('read', 'Catalog');
  return ctx.withTenant((tx) =>
    tx
      .select()
      .from(optionDefs)
      .where(eq(optionDefs.modelId, modelId))
      .orderBy(asc(optionDefs.key))
      .limit(CATALOG_LIMIT),
  );
}

/** Create a catalog option for a model. OEM admin; unique on (model, key). */
export async function createOptionDef(ctx: ServiceContext, input: unknown): Promise<OptionDefRow> {
  const data = parseInput(OptionDefCreateInput, input);
  ctx.policy.assertCan('create', 'Catalog');

  const row = await withUniqueConflict(
    'An option with that key already exists on this model.',
    () =>
      ctx.withTenant(async (tx) => {
        const [model] = await tx
          .select({ id: machineModels.id })
          .from(machineModels)
          .where(eq(machineModels.id, data.modelId))
          .limit(1);
        if (!model) throw new NotFoundError('model', data.modelId);

        const [created] = await tx
          .insert(optionDefs)
          .values({
            tenantId: ctx.tenantId,
            modelId: data.modelId,
            key: data.key,
            label: data.label,
            optionType: data.optionType,
            choices: data.choices ? [...data.choices] : null,
            unit: data.unit ?? null,
            safetyRelevant: data.safetyRelevant,
            description: data.description ?? null,
          })
          .returning();
        return created;
      }),
  );
  if (!row) throw new InternalError('option def insert returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'option_def.created',
    subjectType: 'Catalog',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ optionDefId: row.id, modelId: row.modelId }, 'option def created');
  return row;
}

/** Update a catalog option (label/type/choices/unit/safety/description). Key is fixed. */
export async function updateOptionDef(ctx: ServiceContext, input: unknown): Promise<OptionDefRow> {
  const data = parseInput(OptionDefUpdateInput, input);
  ctx.policy.assertCan('update', 'Catalog');

  const row = await ctx.withTenant(async (tx) => {
    const [existing] = await tx
      .select({ id: optionDefs.id })
      .from(optionDefs)
      .where(eq(optionDefs.id, data.id))
      .limit(1);
    if (!existing) throw new NotFoundError('option', data.id);

    const [updated] = await tx
      .update(optionDefs)
      .set({
        label: data.label,
        optionType: data.optionType,
        choices: data.choices ? [...data.choices] : null,
        unit: data.unit ?? null,
        safetyRelevant: data.safetyRelevant,
        description: data.description ?? null,
        updatedAt: new Date(),
      })
      .where(eq(optionDefs.id, data.id))
      .returning();
    return updated;
  });
  if (!row) throw new InternalError('option def update returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'option_def.updated',
    subjectType: 'Catalog',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ optionDefId: row.id }, 'option def updated');
  return row;
}

/** Delete a catalog option. Serial selections + constraints referencing it cascade. */
export async function deleteOptionDef(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: OptionDefId }> {
  const { id } = parseInput(OptionDefDeleteInput, input);
  ctx.policy.assertCan('delete', 'Catalog');

  await ctx.withTenant(async (tx) => {
    const [existing] = await tx
      .select({ id: optionDefs.id })
      .from(optionDefs)
      .where(eq(optionDefs.id, id))
      .limit(1);
    if (!existing) throw new NotFoundError('option', id);
    await tx.delete(optionDefs).where(eq(optionDefs.id, id));
  });

  ctx.auditor.record({
    kind: 'access',
    action: 'option_def.deleted',
    subjectType: 'Catalog',
    subjectId: id,
    decision: 'allow',
  });
  ctx.logger.info({ optionDefId: id }, 'option def deleted');
  return { id };
}
