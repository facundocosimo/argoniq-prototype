import { z } from 'zod';
import { CompanyId, InstallationId, SiteId, TenantId } from '../ids.js';
import { SerialStatus } from './serial.js';
import { emptyToUndefined } from './_preprocess.js';

/**
 * Installation — the composition axis (installations & asset hierarchy). A
 * functional-location node that groups equipment sold as one system: a production
 * line, a cell, a skid. Equipment (serials) hang off a node; a serial with no
 * installation is a STANDALONE machine. Self-nesting via `parentId` (line → cell).
 */
export const INSTALLATION_KINDS = ['line', 'cell', 'skid', 'system'] as const;
export const InstallationKind = z.enum(INSTALLATION_KINDS);
export type InstallationKind = z.infer<typeof InstallationKind>;

export const Installation = z.object({
  id: InstallationId,
  tenantId: TenantId,
  companyId: CompanyId,
  siteId: SiteId,
  /** Parent installation for line → cell nesting; null at the top level. */
  parentId: InstallationId.nullable().optional(),
  kind: InstallationKind.default('line'),
  /** Stable, human-authored key, e.g. "finishing-line-l1". */
  key: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  commissionedAt: z.date().optional(),
  warrantyExpiresAt: z.date().optional(),
  status: SerialStatus.default('active'),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Installation = z.infer<typeof Installation>;

/**
 * A line viewed with its ordered stations — the read model the schematic renders.
 * `stations` are the member serials ordered by `position`, each carrying just what
 * the diagram needs (identity, family icon, flow position, OEM-of-record).
 */
export const InstallationStation = z.object({
  serialId: z.string(),
  serialNumber: z.string(),
  position: z.number().int().nullable(),
  modelName: z.string(),
  familyName: z.string(),
  /** Curated schematic-icon key for the station's family (oven, conveyor…). */
  iconKey: z.string().nullable(),
  status: SerialStatus,
  /** OEM-of-record — set when a station is bought-in from a third party. */
  manufacturer: z.string().nullable(),
});
export type InstallationStation = z.infer<typeof InstallationStation>;

export const InstallationDetail = z.object({
  installation: Installation,
  stations: z.array(InstallationStation),
});
export type InstallationDetail = z.infer<typeof InstallationDetail>;

/**
 * Write DTOs (management surface). On create, a line binds a customer + site (those
 * fix its home); the `key` is its stable slug. On update only the mutable facts
 * change — customer and key are identity. Date fields accept empty form values.
 */
export const InstallationCreateInput = z.object({
  companyId: CompanyId,
  siteId: SiteId,
  kind: InstallationKind.default('line'),
  key: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  commissionedAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  warrantyExpiresAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  status: SerialStatus.default('active'),
});
export type InstallationCreateInput = z.infer<typeof InstallationCreateInput>;

export const InstallationUpdateInput = z.object({
  id: InstallationId,
  siteId: SiteId,
  kind: InstallationKind,
  name: z.string().min(1).max(200),
  description: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  commissionedAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  warrantyExpiresAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  status: SerialStatus,
});
export type InstallationUpdateInput = z.infer<typeof InstallationUpdateInput>;

export const InstallationDeleteInput = z.object({ id: InstallationId });
export type InstallationDeleteInput = z.infer<typeof InstallationDeleteInput>;
