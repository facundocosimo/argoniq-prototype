import { CASE_STATUSES } from '@argoniq/core-domain';
import { pgEnum, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * DB enum mirrors of the canon vocabulary (@argoniq/core-domain). These are
 * the persisted representations; the TypeScript types remain the source of truth.
 * Keep the two in sync — a value added here must exist there and vice versa.
 */
export const knowledgeTierEnum = pgEnum('knowledge_tier', ['T1', 'T2', 'T3', 'T4']);
// Mirror of DOCUMENT_CATEGORIES in @argoniq/core-domain — keep the two in sync.
export const documentCategoryEnum = pgEnum('document_category', [
  'operation',
  'service',
  'installation',
  'safety',
  'schematic',
  'drawing',
  'parts',
  'certificate',
  'datasheet',
  'bulletin',
  'parameters',
  'backup',
  'cad',
  'other',
]);
export const safetyZoneEnum = pgEnum('safety_zone', ['GREEN', 'YELLOW', 'RED']);
export const answerModeEnum = pgEnum('answer_mode', ['A', 'B', 'C', 'D', 'E', 'F']);
export const confidenceBandEnum = pgEnum('confidence_band', ['HIGH', 'MEDIUM', 'LOW']);
export const configSourceEnum = pgEnum('config_source', [
  'as_built',
  'serial_master',
  'customer_reported',
  'inferred',
  'default',
]);
export const serialStatusEnum = pgEnum('serial_status', [
  'not_installed',
  'active',
  'in_service',
  'maintenance',
  'decommissioned',
]);
export const symptomStatusEnum = pgEnum('symptom_status', ['active', 'deprecated']);

/** Kind of installation (composition node): a production line, a cell, a skid, a system. */
export const installationKindEnum = pgEnum('installation_kind', ['line', 'cell', 'skid', 'system']);

/** How an equipment option is expressed: a boolean module, a chosen level, or a quantity. */
export const optionTypeEnum = pgEnum('option_type', ['boolean', 'choice', 'quantity']);

/** Directed rule between two options of a model (CPQ-lite; no full solver). */
export const optionConstraintRelationEnum = pgEnum('option_constraint_relation', [
  'requires',
  'excludes',
  'implies',
]);
export const variantDataTypeEnum = pgEnum('variant_data_type', [
  'enum',
  'number',
  'boolean',
  'string',
]);
export const caseStatusEnum = pgEnum('case_status', CASE_STATUSES);

/** Functional category of a customer contact (CRM). Mirror of CONTACT_ROLES in
 *  @argoniq/core-domain — keep the two in sync. */
export const contactRoleEnum = pgEnum('contact_role', [
  'maintenance',
  'operations',
  'engineering',
  'management',
  'procurement',
  'quality',
  'other',
]);

/** Standard primary key — a server-generated UUID. */
export const pk = () => uuid('id').primaryKey().defaultRandom();

/**
 * The tenant discriminator present on every tenant-scoped table. RLS policies
 * (src/rls.ts) key on this column via the `app.tenant_id` GUC. Fresh builder per
 * call — drizzle column builders are stateful and must not be shared between
 * tables.
 */
export const tenantId = () => uuid('tenant_id').notNull();

/** Fresh created/updated timestamps. Call as `...timestamps()` in a table. */
export const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
