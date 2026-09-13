import { type OptionConstraintRow, type OptionDefRow } from '@argoniq/db';
import { ValidationError } from '@argoniq/observability';

/** A serial's option selection, keyed by optionDef id. */
export type OptionSelectionMap = Map<string, { present: boolean }>;

/**
 * Validate a serial's option selection against the model's constraint rules —
 * CPQ-lite, three relations. `requires`/`implies`: if the
 * source is fitted the target must be too; `excludes`: they cannot both be fitted.
 * Throws a `ValidationError` listing every violated rule, using option labels.
 */
export function assertOptionSelectionValid(
  defs: readonly OptionDefRow[],
  constraints: readonly OptionConstraintRow[],
  selection: OptionSelectionMap,
): void {
  const labelOf = new Map(defs.map((d) => [d.id, d.label]));
  const isPresent = (optionDefId: string): boolean => selection.get(optionDefId)?.present === true;

  const issues: string[] = [];
  for (const constraint of constraints) {
    const fromLabel = labelOf.get(constraint.fromOptionId) ?? 'an option';
    const toLabel = labelOf.get(constraint.toOptionId) ?? 'another option';
    if (!isPresent(constraint.fromOptionId)) continue;

    if (constraint.relation === 'excludes') {
      if (isPresent(constraint.toOptionId)) {
        issues.push(`${fromLabel} cannot be fitted together with ${toLabel}.`);
      }
    } else {
      // requires | implies
      if (!isPresent(constraint.toOptionId)) {
        issues.push(`${fromLabel} requires ${toLabel} to also be fitted.`);
      }
    }
  }

  if (issues.length > 0) {
    throw new ValidationError(`Invalid option selection: ${issues.join(' ')}`, {
      details: { issues },
    });
  }
}
