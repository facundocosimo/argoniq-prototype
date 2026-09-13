import { eq } from 'drizzle-orm';
import { SetSerialOptionsInput } from '@argoniq/core-domain';
import { optionConstraints, optionDefs, serialOptions, serials } from '@argoniq/db';
import { NotFoundError, ValidationError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { assertOptionSelectionValid, type OptionSelectionMap } from './option-constraints.js';

/**
 * Replace a serial's option selection (as-ordered). Every selected option must
 * belong to the serial's model; a `choice` value must be one of its declared
 * levels; the whole set must satisfy the model's constraint rules. The write is
 * all-or-nothing inside one tenant-scoped transaction.
 */
export async function setSerialOptions(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ serialId: string; count: number }> {
  const data = parseInput(SetSerialOptionsInput, input);
  ctx.policy.assertCan('update', 'Serial', { id: data.serialId });

  const count = await ctx.withTenant(async (tx) => {
    const [serial] = await tx
      .select({ id: serials.id, modelId: serials.modelId, companyId: serials.companyId })
      .from(serials)
      .where(eq(serials.id, data.serialId))
      .limit(1);
    if (!serial) throw new NotFoundError('serial', data.serialId);

    const defs = await tx.select().from(optionDefs).where(eq(optionDefs.modelId, serial.modelId));
    const defById = new Map(defs.map((d) => [d.id, d]));

    // Every selection must reference a catalog option of THIS model.
    for (const selection of data.selections) {
      const def = defById.get(selection.optionDefId);
      if (!def) {
        throw new ValidationError('An option does not belong to this machine model.');
      }
      if (selection.present && def.optionType === 'choice') {
        const allowed = def.choices ?? [];
        if (!selection.chosenValue || !allowed.includes(selection.chosenValue)) {
          throw new ValidationError(`"${def.label}" needs one of its allowed values.`);
        }
      }
    }

    const constraints = await tx
      .select()
      .from(optionConstraints)
      .where(eq(optionConstraints.modelId, serial.modelId));
    const selectionMap: OptionSelectionMap = new Map(
      data.selections.map((s) => [s.optionDefId, { present: s.present }]),
    );
    assertOptionSelectionValid(defs, constraints, selectionMap);

    // Full replace: clear then insert the current selection.
    await tx.delete(serialOptions).where(eq(serialOptions.serialId, data.serialId));
    const rows = data.selections.map((s) => ({
      tenantId: ctx.tenantId,
      serialId: data.serialId,
      optionDefId: s.optionDefId,
      present: s.present,
      chosenValue: s.present && s.chosenValue ? s.chosenValue : null,
    }));
    if (rows.length > 0) await tx.insert(serialOptions).values(rows);
    return rows.length;
  });

  ctx.auditor.record({
    kind: 'access',
    action: 'serial.options_set',
    subjectType: 'Serial',
    subjectId: data.serialId,
    decision: 'allow',
  });
  ctx.logger.info({ serialId: data.serialId, count }, 'serial options set');
  return { serialId: data.serialId, count };
}
