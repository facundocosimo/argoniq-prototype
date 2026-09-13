import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { OptionDefId, type ResolvedOption, SerialId } from '@argoniq/core-domain';
import { optionDefs, serialOptions, serials } from '@argoniq/db';
import { NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

export const ResolveSerialOptionsInput = z.object({ serialId: SerialId });
export type ResolveSerialOptionsInput = z.infer<typeof ResolveSerialOptionsInput>;

/**
 * Resolve a serial's equipment options — the catalog (per model) joined to the
 * serial's selection. One generic renderer consumes this for ANY family: booleans
 * show present/absent, choice/quantity show the chosen value, and `safetyRelevant`
 * drives the flag the answer pipeline's safety gate consumes. An option in the
 * catalog with no recorded selection returns `recorded: false` (present: false).
 */
export async function resolveSerialOptions(
  ctx: ServiceContext,
  input: unknown,
): Promise<ResolvedOption[]> {
  const { serialId } = parseInput(ResolveSerialOptionsInput, input);
  ctx.policy.assertCan('read', 'Serial');

  const data = await ctx.withTenant(async (tx) => {
    const [serial] = await tx.select().from(serials).where(eq(serials.id, serialId)).limit(1);
    if (!serial) return null;
    const defs = await tx
      .select()
      .from(optionDefs)
      .where(eq(optionDefs.modelId, serial.modelId))
      .orderBy(asc(optionDefs.key));
    const selections = await tx
      .select()
      .from(serialOptions)
      .where(eq(serialOptions.serialId, serialId));
    return { serial, defs, selections };
  });
  if (!data) throw new NotFoundError('serial', serialId);

  ctx.policy.assertCan('read', 'Serial', {
    id: data.serial.id,
    companyId: data.serial.companyId,
  });

  const selectionByDef = new Map(data.selections.map((s) => [s.optionDefId, s]));
  return data.defs.map((def) => {
    const selection = selectionByDef.get(def.id);
    return {
      optionDefId: OptionDefId.parse(def.id),
      key: def.key,
      label: def.label,
      optionType: def.optionType,
      safetyRelevant: def.safetyRelevant,
      unit: def.unit ?? null,
      choices: def.choices ?? null,
      present: selection ? selection.present : false,
      chosenValue: selection?.chosenValue ?? null,
      recorded: Boolean(selection),
    } satisfies ResolvedOption;
  });
}
