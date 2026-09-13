import { z } from 'zod';
import { MachineFamilyId, MachineModelId, TenantId } from '../ids.js';
import { emptyToNull, emptyToUndefined } from './_preprocess.js';

/** A model within a family, e.g. "Atlas Training Cell". Carries variant-axis definitions. */
export const MachineModel = z.object({
  id: MachineModelId,
  tenantId: TenantId,
  familyId: MachineFamilyId,
  key: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  /** Canonical product image URL for this model (all serials of a model look alike). */
  imageUrl: z.string().max(1024).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MachineModel = z.infer<typeof MachineModel>;

/**
 * Write DTOs (Catalog Studio). A model belongs to a family (`familyId`, set at
 * create and fixed thereafter — re-parenting a model would orphan its serials' as-built
 * config). `key` is identity: immutable after create.
 */
export const MachineModelCreateInput = z.object({
  familyId: MachineFamilyId,
  key: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers and hyphens'),
  name: z.string().min(1).max(200),
  description: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  imageUrl: z.preprocess(emptyToNull, z.string().url().max(1024).nullable()),
});
export type MachineModelCreateInput = z.infer<typeof MachineModelCreateInput>;

/** `familyId` and `key` are fixed after create; only the display fields change. */
export const MachineModelUpdateInput = MachineModelCreateInput.omit({
  familyId: true,
  key: true,
}).extend({ id: MachineModelId });
export type MachineModelUpdateInput = z.infer<typeof MachineModelUpdateInput>;

export const MachineModelDeleteInput = z.object({ id: MachineModelId });
export type MachineModelDeleteInput = z.infer<typeof MachineModelDeleteInput>;
