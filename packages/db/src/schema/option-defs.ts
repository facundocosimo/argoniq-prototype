import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { optionTypeEnum, pk, tenantId, timestamps } from './_shared.js';
import { machineModels } from './machine-models.js';
import { tenants } from './tenants.js';

/**
 * Option catalog — the configuration axis, catalog (type) layer. An `optionDef`
 * is an installable MODULE a model can carry (top silo, dust filter, premium
 * vacuum pump, explosion kit): present/absent, addable/removable over life, and
 * possibly `safetyRelevant`. This is distinct from a `variantAxis`, which is a
 * scalar VALUE (inert gas = Argon). Axis = a value; option = a thing. A serial's
 * chosen options live in `serial_options`; rules between options in
 * `option_constraints`. Tenant-scoped (RLS).
 */
export const optionDefs = pgTable(
  'option_defs',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    modelId: uuid('model_id')
      .notNull()
      .references(() => machineModels.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 63 }).notNull(),
    label: varchar('label', { length: 200 }).notNull(),
    optionType: optionTypeEnum('option_type').notNull(),
    /** Allowed values for `choice` options (e.g. ["standard","premium"]). */
    choices: jsonb('choices').$type<string[]>(),
    /** Unit for `quantity` options (e.g. "kW", "bar"). */
    unit: varchar('unit', { length: 32 }),
    safetyRelevant: boolean('safety_relevant').notNull().default(false),
    description: text('description'),
    ...timestamps(),
  },
  (t) => [
    index('option_defs_tenant_idx').on(t.tenantId),
    index('option_defs_model_idx').on(t.modelId),
    uniqueIndex('option_defs_model_key_uq').on(t.modelId, t.key),
  ],
);

export type OptionDefRow = typeof optionDefs.$inferSelect;
export type NewOptionDefRow = typeof optionDefs.$inferInsert;
