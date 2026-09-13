import { z } from 'zod';
import { MachineFamilyId, MachineModelId, SerialId } from '../ids.js';
import { ConfidenceBand } from '../confidence.js';
import { VariantOptionValue } from './serial.js';

/**
 * Machine configuration with a source and confidence for each attribute. The
 * current builder reads stored option values and firmware; missing options are
 * marked as defaults with low confidence. The answer service includes the
 * summary as context and treats low overall confidence conservatively.
 */
export const CONFIG_SOURCES = [
  'as_built',
  'serial_master',
  'customer_reported',
  'inferred',
  'default',
] as const;
export const ConfigSource = z.enum(CONFIG_SOURCES);
export type ConfigSource = z.infer<typeof ConfigSource>;

export const EffectiveConfigAttribute = z.object({
  /** References a VariantAxis.key, e.g. "material", "inert_gas". */
  key: z.string().min(1),
  label: z.string().min(1),
  value: VariantOptionValue,
  source: ConfigSource,
  confidence: ConfidenceBand,
  /** When this value was last known to be true. */
  asOf: z.date().optional(),
});
export type EffectiveConfigAttribute = z.infer<typeof EffectiveConfigAttribute>;

export const EffectiveConfig = z.object({
  serialId: SerialId,
  modelId: MachineModelId,
  familyId: MachineFamilyId,
  resolvedAt: z.date(),
  attributes: z.array(EffectiveConfigAttribute),
  /** The weakest-link confidence across attributes that matter for the question. */
  overallConfidence: ConfidenceBand,
});
export type EffectiveConfig = z.infer<typeof EffectiveConfig>;
