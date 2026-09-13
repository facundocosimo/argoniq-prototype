import { z } from 'zod';

/**
 * Branded identifiers.
 *
 * Every entity id is a branded UUID. Branding makes ids nominally typed, so a
 * `SerialId` can never be passed where a `CompanyId` is expected — a whole
 * class of cross-entity bugs becomes a compile error. Each schema both validates
 * at runtime (zod) and produces the brand at the type level, so there is one
 * source of truth per id.
 *
 * Usage:
 *   const id = SerialId.parse(row.id);        // runtime-validated, typed SerialId
 *   function get(id: SerialId):...           // compiler rejects a TenantId here
 */

const brandedId = <Brand extends string>(_brand: Brand) => z.string().uuid().brand<Brand>();

export const TenantId = brandedId('TenantId');
export type TenantId = z.infer<typeof TenantId>;

export const CompanyId = brandedId('CompanyId');
export type CompanyId = z.infer<typeof CompanyId>;

export const SiteId = brandedId('SiteId');
export type SiteId = z.infer<typeof SiteId>;

export const ContactId = brandedId('ContactId');
export type ContactId = z.infer<typeof ContactId>;

export const UserId = brandedId('UserId');
export type UserId = z.infer<typeof UserId>;

export const MachineFamilyId = brandedId('MachineFamilyId');
export type MachineFamilyId = z.infer<typeof MachineFamilyId>;

export const MachineModelId = brandedId('MachineModelId');
export type MachineModelId = z.infer<typeof MachineModelId>;

export const VariantId = brandedId('VariantId');
export type VariantId = z.infer<typeof VariantId>;

export const InstallationId = brandedId('InstallationId');
export type InstallationId = z.infer<typeof InstallationId>;

export const SerialId = brandedId('SerialId');
export type SerialId = z.infer<typeof SerialId>;

export const OptionDefId = brandedId('OptionDefId');
export type OptionDefId = z.infer<typeof OptionDefId>;

export const SerialOptionId = brandedId('SerialOptionId');
export type SerialOptionId = z.infer<typeof SerialOptionId>;

export const OptionConstraintId = brandedId('OptionConstraintId');
export type OptionConstraintId = z.infer<typeof OptionConstraintId>;

export const ComponentId = brandedId('ComponentId');
export type ComponentId = z.infer<typeof ComponentId>;

export const DocumentId = brandedId('DocumentId');
export type DocumentId = z.infer<typeof DocumentId>;

export const DocumentChunkId = brandedId('DocumentChunkId');
export type DocumentChunkId = z.infer<typeof DocumentChunkId>;

export const PlaybookId = brandedId('PlaybookId');
export type PlaybookId = z.infer<typeof PlaybookId>;

export const SymptomId = brandedId('SymptomId');
export type SymptomId = z.infer<typeof SymptomId>;

export const CaseId = brandedId('CaseId');
export type CaseId = z.infer<typeof CaseId>;

export const PartId = brandedId('PartId');
export type PartId = z.infer<typeof PartId>;
