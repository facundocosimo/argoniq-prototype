import { index, integer, jsonb, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk, symptomStatusEnum, tenantId, timestamps } from './_shared.js';
import { machineFamilies } from './machine-families.js';
import { tenants } from './tenants.js';

/**
 * Canonical symptoms  — cause-neutral observation classes, identified by
 * the stable triple key · path · label. Controlled, versioned, human-curated.
 * Tenant-scoped (RLS).
 */
export const symptoms = pgTable(
  'symptoms',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id')
      .notNull()
      .references(() => machineFamilies.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 100 }).notNull(),
    path: varchar('path', { length: 200 }).notNull(),
    label: varchar('label', { length: 300 }).notNull(),
    contextQualifiers: jsonb('context_qualifiers').$type<string[]>().notNull().default([]),
    status: symptomStatusEnum('status').notNull().default('active'),
    version: integer('version').notNull().default(1),
    ...timestamps(),
  },
  (t) => [
    index('symptoms_tenant_idx').on(t.tenantId),
    index('symptoms_family_idx').on(t.familyId),
    uniqueIndex('symptoms_tenant_key_uq').on(t.tenantId, t.key),
  ],
);

export type SymptomRow = typeof symptoms.$inferSelect;
export type NewSymptomRow = typeof symptoms.$inferInsert;
