import { boolean, index, jsonb, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk, tenantId, timestamps, variantDataTypeEnum } from './_shared.js';
import { machineModels } from './machine-models.js';
import { tenants } from './tenants.js';

/**
 * Variant axes — the configurable dimensions of a model (profile, sensor count,
 * inspection mode, firmware). Serials resolve a value per axis; those feed
 * the EffectiveConfig. `safetyRelevant` axes change which procedures are safe.
 */
export const variantAxes = pgTable(
  'variant_axes',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    modelId: uuid('model_id')
      .notNull()
      .references(() => machineModels.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 63 }).notNull(),
    label: varchar('label', { length: 200 }).notNull(),
    dataType: variantDataTypeEnum('data_type').notNull(),
    options: jsonb('options').$type<string[]>(),
    unit: varchar('unit', { length: 32 }),
    safetyRelevant: boolean('safety_relevant').notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    index('variant_axes_tenant_idx').on(t.tenantId),
    uniqueIndex('variant_axes_model_key_uq').on(t.modelId, t.key),
  ],
);

export type VariantAxisRow = typeof variantAxes.$inferSelect;
export type NewVariantAxisRow = typeof variantAxes.$inferInsert;
