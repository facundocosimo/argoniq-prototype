import { index, pgTable, uuid } from 'drizzle-orm/pg-core';
import { optionConstraintRelationEnum, pk, tenantId, timestamps } from './_shared.js';
import { machineModels } from './machine-models.js';
import { optionDefs } from './option-defs.js';
import { tenants } from './tenants.js';

/**
 * Option constraints — the configuration axis, rules layer. A directed relation
 * between two options of the same model: `requires` (explosion kit requires the
 * antistatic filter), `excludes` (premium pump excludes the standard silo), or
 * `implies`. Deliberately three relations, not a full Boolean dependency solver —
 * this is CPQ-lite, validated in the service layer on selection. Tenant-scoped (RLS).
 */
export const optionConstraints = pgTable(
  'option_constraints',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    modelId: uuid('model_id')
      .notNull()
      .references(() => machineModels.id, { onDelete: 'cascade' }),
    fromOptionId: uuid('from_option_id')
      .notNull()
      .references(() => optionDefs.id, { onDelete: 'cascade' }),
    relation: optionConstraintRelationEnum('relation').notNull(),
    toOptionId: uuid('to_option_id')
      .notNull()
      .references(() => optionDefs.id, { onDelete: 'cascade' }),
    ...timestamps(),
  },
  (t) => [
    index('option_constraints_tenant_idx').on(t.tenantId),
    index('option_constraints_model_idx').on(t.modelId),
  ],
);

export type OptionConstraintRow = typeof optionConstraints.$inferSelect;
export type NewOptionConstraintRow = typeof optionConstraints.$inferInsert;
