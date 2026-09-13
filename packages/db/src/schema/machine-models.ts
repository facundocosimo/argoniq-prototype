import { foreignKey, index, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk, tenantId, timestamps } from './_shared.js';
import { machineFamilies } from './machine-families.js';
import { tenants } from './tenants.js';

/** Models within a family, e.g. "Atlas Training Cell". Tenant-scoped (RLS). */
export const machineModels = pgTable(
  'machine_models',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    key: varchar('key', { length: 63 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    /** Canonical product image for this model (all serials of a model look alike). */
    imageUrl: varchar('image_url', { length: 1024 }),
    ...timestamps(),
  },
  (t) => [
    index('machine_models_tenant_idx').on(t.tenantId),
    index('machine_models_family_idx').on(t.familyId),
    uniqueIndex('machine_models_tenant_key_uq').on(t.tenantId, t.key),
    uniqueIndex('machine_models_tenant_id_uq').on(t.tenantId, t.id),
    uniqueIndex('machine_models_tenant_id_family_uq').on(t.tenantId, t.id, t.familyId),
    foreignKey({
      name: 'machine_models_tenant_family_fk',
      columns: [t.tenantId, t.familyId],
      foreignColumns: [machineFamilies.tenantId, machineFamilies.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
  ],
);

export type MachineModelRow = typeof machineModels.$inferSelect;
export type NewMachineModelRow = typeof machineModels.$inferInsert;
