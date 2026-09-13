import { type VariantOptionValue } from '@argoniq/core-domain';
import { type VariantAxisRow } from '@argoniq/db';
import { ValidationError } from '@argoniq/observability';

/**
 * Validate a serial's resolved `optionValues` against its model's variant axes —
 * the edge that keeps the EffectiveConfig honest (step 2). Every key
 * must name a real axis of the model, and every value must satisfy that axis's data
 * type (an `enum` value must be one of its options). Partial coverage is allowed —
 * a serial need not resolve every axis — but an unknown key or a mistyped value is
 * a caller error, raised as a `ValidationError` before anything is written.
 */
export function assertOptionValuesValid(
  axes: readonly VariantAxisRow[],
  optionValues: Record<string, VariantOptionValue>,
): void {
  const byKey = new Map(axes.map((axis) => [axis.key, axis]));
  const issues: string[] = [];

  for (const [key, value] of Object.entries(optionValues)) {
    const axis = byKey.get(key);
    if (!axis) {
      issues.push(`unknown option "${key}" for this model`);
      continue;
    }
    switch (axis.dataType) {
      case 'enum': {
        const options = axis.options ?? [];
        if (typeof value !== 'string' || !options.includes(value)) {
          issues.push(`"${axis.label}" must be one of: ${options.join(', ')}`);
        }
        break;
      }
      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value))
          issues.push(`"${axis.label}" must be a number`);
        break;
      case 'boolean':
        if (typeof value !== 'boolean') issues.push(`"${axis.label}" must be true or false`);
        break;
      case 'string':
        if (typeof value !== 'string') issues.push(`"${axis.label}" must be text`);
        break;
    }
  }

  if (issues.length > 0) {
    throw new ValidationError(`Invalid configuration: ${issues.join('; ')}`, {
      details: { issues },
    });
  }
}
