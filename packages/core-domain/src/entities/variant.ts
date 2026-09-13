import { z } from 'zod';
import { MachineModelId, TenantId, VariantId } from '../ids.js';
import { emptyToUndefined } from './_preprocess.js';

/**
 * Variant axes. A model declares the dimensions along which
 * its units differ — e.g. profile, sensor count, inspection mode,
 * inert gas, firmware version. A serial resolves a value per axis; those
 * resolved values feed the EffectiveConfig. Axes flagged `safetyRelevant` change
 * which procedures are safe and therefore gate answer modes.
 */
export const VARIANT_DATA_TYPES = ['enum', 'number', 'boolean', 'string'] as const;
export const VariantDataType = z.enum(VARIANT_DATA_TYPES);
export type VariantDataType = z.infer<typeof VariantDataType>;

export const VariantAxis = z.object({
  id: VariantId,
  tenantId: TenantId,
  modelId: MachineModelId,
  /** Stable key used in EffectiveConfig attributes, e.g. "material", "laser_count". */
  key: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(200),
  dataType: VariantDataType,
  /** Allowed values for `enum` axes (e.g. ["LAB-A", "LAB-B"]). */
  options: z.array(z.string()).optional(),
  /** Unit for `number` axes (e.g. "lasers", "mm"). */
  unit: z.string().optional(),
  safetyRelevant: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type VariantAxis = z.infer<typeof VariantAxis>;

const axisKey = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9_]+$/, 'lowercase_with_underscores');

/**
 * Write DTOs (Catalog Studio). An axis belongs to a model. `enum` axes must declare
 * their allowed `options`; every other data type must not carry them (mirrors the
 * option-catalog choice rule). `key` and `modelId` are identity: fixed after create,
 * because a serial's stored as-built value is keyed by them.
 */
export const VariantAxisCreateInput = z
  .object({
    modelId: MachineModelId,
    key: axisKey,
    label: z.string().min(1).max(200),
    dataType: VariantDataType,
    options: z.array(z.string().min(1).max(200)).optional(),
    unit: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
    safetyRelevant: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.dataType === 'enum' && (!value.options || value.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'An enum axis needs at least one allowed value.',
      });
    }
    if (value.dataType !== 'enum' && value.options && value.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Only enum axes may declare allowed values.',
      });
    }
  });
export type VariantAxisCreateInput = z.infer<typeof VariantAxisCreateInput>;

export const VariantAxisUpdateInput = z
  .object({
    id: VariantId,
    label: z.string().min(1).max(200),
    dataType: VariantDataType,
    options: z.array(z.string().min(1).max(200)).optional(),
    unit: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
    safetyRelevant: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.dataType === 'enum' && (!value.options || value.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'An enum axis needs at least one allowed value.',
      });
    }
    if (value.dataType !== 'enum' && value.options && value.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Only enum axes may declare allowed values.',
      });
    }
  });
export type VariantAxisUpdateInput = z.infer<typeof VariantAxisUpdateInput>;

export const VariantAxisDeleteInput = z.object({ id: VariantId });
export type VariantAxisDeleteInput = z.infer<typeof VariantAxisDeleteInput>;
