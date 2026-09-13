import { index, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { pk, tenantId, timestamps } from './_shared.js';
import { tenants } from './tenants.js';

/** Machine families — the unit at which knowledge is authored once. Data, not code. */
export const machineFamilies = pgTable(
  'machine_families',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 63 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    /** Curated schematic-icon key (oven, conveyor, coater, cabin, printer, robot…). */
    iconKey: varchar('icon_key', { length: 63 }),
    ...timestamps(),
  },
  (t) => [
    index('machine_families_tenant_idx').on(t.tenantId),
    uniqueIndex('machine_families_tenant_key_uq').on(t.tenantId, t.key),
    uniqueIndex('machine_families_tenant_id_uq').on(t.tenantId, t.id),
  ],
);

export type MachineFamilyRow = typeof machineFamilies.$inferSelect;
export type NewMachineFamilyRow = typeof machineFamilies.$inferInsert;
