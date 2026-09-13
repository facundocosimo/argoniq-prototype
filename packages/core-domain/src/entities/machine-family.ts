import { z } from 'zod';
import { MachineFamilyId, TenantId } from '../ids.js';
import { emptyToNull, emptyToUndefined } from './_preprocess.js';

/**
 * A machine family — the unit at which knowledge is authored once.
 * The framework is family-agnostic: the family, its models, variant axes,
 * ontology, and playbooks are all *data*, created via onboarding and seeded —
 * never hard-coded. The prototype seeds "Metal AM / LPBF printers".
 */
export const MachineFamily = z.object({
  id: MachineFamilyId,
  tenantId: TenantId,
  /** Stable, human-authored key, e.g. "metal-am-lpbf". */
  key: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  /** Curated schematic-icon key used by the line diagram (oven, conveyor, printer…). */
  iconKey: z.string().max(63).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MachineFamily = z.infer<typeof MachineFamily>;

/**
 * Write DTOs (Catalog Studio). A family is the top of the product/type catalog and
 * has no parent — the tenant is implicit (ctx). `key` is identity: immutable after
 * create. The same schema validates on the client (`useZodForm`) and server
 * (`parseInput`), so the two can never drift.
 */
export const MachineFamilyCreateInput = z.object({
  key: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers and hyphens'),
  name: z.string().min(1).max(200),
  description: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  iconKey: z.preprocess(emptyToNull, z.string().max(63).nullable()),
});
export type MachineFamilyCreateInput = z.infer<typeof MachineFamilyCreateInput>;

/** `key` is fixed after create; only the display fields change. */
export const MachineFamilyUpdateInput = MachineFamilyCreateInput.omit({ key: true }).extend({
  id: MachineFamilyId,
});
export type MachineFamilyUpdateInput = z.infer<typeof MachineFamilyUpdateInput>;

export const MachineFamilyDeleteInput = z.object({ id: MachineFamilyId });
export type MachineFamilyDeleteInput = z.infer<typeof MachineFamilyDeleteInput>;
