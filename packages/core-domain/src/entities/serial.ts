import { z } from 'zod';
import { CompanyId, MachineFamilyId, MachineModelId, SerialId, SiteId, TenantId } from '../ids.js';
import { emptyToUndefined } from './_preprocess.js';

/**
 * Lifecycle state of a machine — distinct from its case-derived health. `active` /
 * `in_service` are operational; `not_installed` (ordered, awaiting install),
 * `maintenance` (temporarily out), and `decommissioned` (retired) are not.
 */
export const SERIAL_STATUSES = [
  'not_installed',
  'active',
  'in_service',
  'maintenance',
  'decommissioned',
] as const;
export const SerialStatus = z.enum(SERIAL_STATUSES);
export type SerialStatus = z.infer<typeof SerialStatus>;

/** A resolved value along a variant axis (string/number/boolean). */
export const VariantOptionValue = z.union([z.string(), z.number(), z.boolean()]);
export type VariantOptionValue = z.infer<typeof VariantOptionValue>;

/** An installed machine and the configuration values recorded for it. */
export const Serial = z.object({
  id: SerialId,
  tenantId: TenantId,
  companyId: CompanyId,
  siteId: SiteId,
  familyId: MachineFamilyId,
  modelId: MachineModelId,
  /** Human-facing serial number, e.g. "ATLAS-DEMO-001". */
  serialNumber: z.string().min(1).max(100),
  /** Resolved value per variant-axis key (keys reference VariantAxis.key). */
  optionValues: z.record(z.string(), VariantOptionValue).default({}),
  firmwareVersion: z.string().max(100).optional(),
  installedAt: z.date().optional(),
  commissionedAt: z.date().optional(),
  status: SerialStatus.default('active'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Serial = z.infer<typeof Serial>;

/**
 * Write DTOs (management surface). On create, a serial binds a customer + site +
 * family + model. Those four define the machine's identity, so on update only the
 * mutable facts change (site within the same customer, serial number, firmware,
 * status, resolved option values); re-homing a machine to a different family/model
 * is a new record. `optionValues` are shape-checked here and value-checked against
 * the model's variant axes in the service (the axis catalog is not in the DTO).
 */
export const SerialCreateInput = z.object({
  companyId: CompanyId,
  siteId: SiteId,
  familyId: MachineFamilyId,
  modelId: MachineModelId,
  serialNumber: z.string().min(1).max(100),
  optionValues: z.record(z.string(), VariantOptionValue).default({}),
  firmwareVersion: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
  status: SerialStatus.default('active'),
});
export type SerialCreateInput = z.infer<typeof SerialCreateInput>;

export const SerialUpdateInput = z.object({
  id: SerialId,
  siteId: SiteId,
  serialNumber: z.string().min(1).max(100),
  optionValues: z.record(z.string(), VariantOptionValue).default({}),
  firmwareVersion: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
  status: SerialStatus,
});
export type SerialUpdateInput = z.infer<typeof SerialUpdateInput>;

export const SerialDeleteInput = z.object({ id: SerialId });
export type SerialDeleteInput = z.infer<typeof SerialDeleteInput>;
