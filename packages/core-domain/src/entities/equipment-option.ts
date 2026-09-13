import { z } from 'zod';
import {
  InstallationId,
  MachineModelId,
  OptionConstraintId,
  OptionDefId,
  SerialId,
  SerialOptionId,
  TenantId,
} from '../ids.js';
import { emptyToNull, emptyToUndefined } from './_preprocess.js';

/**
 * Equipment options — the configuration axis (installations & asset
 * hierarchy). An option is an installable MODULE (top silo, dust filter, premium
 * vacuum pump, explosion kit): present/absent, addable over life, possibly
 * `safetyRelevant`. This is distinct from a variant AXIS, which is a scalar value.
 * Axis = a value; option = a thing. The catalog is per model; the selection is per
 * serial; the rules are `OptionConstraint`s.
 */
export const OPTION_TYPES = ['boolean', 'choice', 'quantity'] as const;
export const OptionType = z.enum(OPTION_TYPES);
export type OptionType = z.infer<typeof OptionType>;

export const OptionConstraintRelation = z.enum(['requires', 'excludes', 'implies']);
export type OptionConstraintRelation = z.infer<typeof OptionConstraintRelation>;

/** Catalog (type) layer — what options a model offers. */
export const OptionDef = z.object({
  id: OptionDefId,
  tenantId: TenantId,
  modelId: MachineModelId,
  key: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(200),
  optionType: OptionType,
  /** Allowed levels for a `choice` option (e.g. ["standard","premium"]). */
  choices: z.array(z.string()).optional(),
  unit: z.string().max(32).optional(),
  safetyRelevant: z.boolean().default(false),
  description: z.string().max(2000).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type OptionDef = z.infer<typeof OptionDef>;

/** Selection (as-ordered) layer — what a specific serial was built with. */
export const SerialOption = z.object({
  id: SerialOptionId,
  tenantId: TenantId,
  serialId: SerialId,
  optionDefId: OptionDefId,
  present: z.boolean().default(true),
  chosenValue: z.string().max(200).nullable().optional(),
  installedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type SerialOption = z.infer<typeof SerialOption>;

/** Rules layer — a directed relation between two options of a model. */
export const OptionConstraint = z.object({
  id: OptionConstraintId,
  tenantId: TenantId,
  modelId: MachineModelId,
  fromOptionId: OptionDefId,
  relation: OptionConstraintRelation,
  toOptionId: OptionDefId,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type OptionConstraint = z.infer<typeof OptionConstraint>;

/**
 * Resolved option — catalog joined to a serial's selection, the read model the
 * equipment spec sheet renders. One generic renderer handles every family: a
 * boolean option shows present/absent, a choice/quantity shows the chosen value,
 * and `safetyRelevant` drives the safety flag the answer pipeline consumes.
 */
export const ResolvedOption = z.object({
  optionDefId: OptionDefId,
  key: z.string(),
  label: z.string(),
  optionType: OptionType,
  safetyRelevant: z.boolean(),
  unit: z.string().nullable(),
  /** Allowed levels for a `choice` option (for the editor); null otherwise. */
  choices: z.array(z.string()).nullable(),
  /** True when the module is installed on this serial (false = deliberately absent). */
  present: z.boolean(),
  /** The picked level for a choice/quantity option; null for a boolean module. */
  chosenValue: z.string().nullable(),
  /** False when the serial has no recorded selection for this catalog option yet. */
  recorded: z.boolean(),
});
export type ResolvedOption = z.infer<typeof ResolvedOption>;

const optionKey = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9_]+$/);

/**
 * Write DTOs. A `choice` option must declare its allowed levels; `boolean`/`quantity`
 * must not carry `choices`. `key` is identity (immutable on update).
 */
export const OptionDefCreateInput = z
  .object({
    modelId: MachineModelId,
    key: optionKey,
    label: z.string().min(1).max(200),
    optionType: OptionType,
    choices: z.array(z.string().min(1).max(200)).optional(),
    unit: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
    safetyRelevant: z.boolean().default(false),
    description: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  })
  .superRefine((value, ctx) => {
    if (value.optionType === 'choice' && (!value.choices || value.choices.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choices'],
        message: 'A choice option needs at least one allowed value.',
      });
    }
    if (value.optionType !== 'choice' && value.choices && value.choices.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choices'],
        message: 'Only choice options may declare allowed values.',
      });
    }
  });
export type OptionDefCreateInput = z.infer<typeof OptionDefCreateInput>;

export const OptionDefUpdateInput = z
  .object({
    id: OptionDefId,
    label: z.string().min(1).max(200),
    optionType: OptionType,
    choices: z.array(z.string().min(1).max(200)).optional(),
    unit: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
    safetyRelevant: z.boolean().default(false),
    description: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  })
  .superRefine((value, ctx) => {
    if (value.optionType === 'choice' && (!value.choices || value.choices.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choices'],
        message: 'A choice option needs at least one allowed value.',
      });
    }
  });
export type OptionDefUpdateInput = z.infer<typeof OptionDefUpdateInput>;

export const OptionDefDeleteInput = z.object({ id: OptionDefId });
export type OptionDefDeleteInput = z.infer<typeof OptionDefDeleteInput>;

/** One picked option in a serial's selection set. */
export const OptionSelectionInput = z.object({
  optionDefId: OptionDefId,
  present: z.boolean(),
  chosenValue: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
});
export type OptionSelectionInput = z.infer<typeof OptionSelectionInput>;

/** Replace a serial's full option selection (as-ordered). */
export const SetSerialOptionsInput = z.object({
  serialId: SerialId,
  selections: z.array(OptionSelectionInput),
});
export type SetSerialOptionsInput = z.infer<typeof SetSerialOptionsInput>;

/** Assign a serial to a line (or detach it) and set its flow position / OEM-of-record. */
export const AssignSerialInput = z.object({
  serialId: SerialId,
  installationId: InstallationId.nullable(),
  position: z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(9999).nullable()),
  manufacturer: z.preprocess(emptyToNull, z.string().max(200).nullable()),
});
export type AssignSerialInput = z.infer<typeof AssignSerialInput>;
