import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { pk, serialStatusEnum, tenantId, timestamps } from './_shared.js';
import { companies } from './companies.js';
import { installations } from './installations.js';
import { machineFamilies } from './machine-families.js';
import { machineModels } from './machine-models.js';
import { sites } from './sites.js';
import { tenants } from './tenants.js';

/** Installed machines and their recorded configuration. Tenant-scoped by RLS. */
export const serials = pgTable(
  'serials',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').notNull(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'restrict' }),
    /**
     * Composition: the installation (line/cell) this machine belongs to. NULL = a
     * standalone machine, which needs no installation row.
     */
    installationId: uuid('installation_id'),
    /** Order within the installation (material-flow position); null for standalone. */
    position: integer('position'),
    /** OEM-of-record for bought-in stations in a line (e.g. a third-party conveyor). */
    manufacturer: varchar('manufacturer', { length: 200 }),
    familyId: uuid('family_id').notNull(),
    modelId: uuid('model_id').notNull(),
    serialNumber: varchar('serial_number', { length: 100 }).notNull(),
    /** Company-assigned factory tag / asset nickname (e.g. "ATLAS-001") — the client's
     *  own label for this machine, distinct from the OEM serial number. Nullable. */
    customerTag: varchar('customer_tag', { length: 100 }),
    optionValues: jsonb('option_values')
      .$type<Record<string, string | number | boolean>>()
      .notNull()
      .default({}),
    firmwareVersion: varchar('firmware_version', { length: 100 }),
    installedAt: timestamp('installed_at', { withTimezone: true }),
    commissionedAt: timestamp('commissioned_at', { withTimezone: true }),
    status: serialStatusEnum('status').notNull().default('active'),
    ...timestamps(),
  },
  (t) => [
    index('serials_tenant_idx').on(t.tenantId),
    index('serials_company_idx').on(t.companyId),
    index('serials_installation_idx').on(t.installationId),
    index('serials_model_idx').on(t.modelId),
    uniqueIndex('serials_tenant_serial_number_uq').on(t.tenantId, t.serialNumber),
    uniqueIndex('serials_tenant_id_company_uq').on(t.tenantId, t.id, t.companyId),
    uniqueIndex('serials_tenant_id_family_uq').on(t.tenantId, t.id, t.familyId),
    uniqueIndex('serials_tenant_id_model_uq').on(t.tenantId, t.id, t.modelId),
    uniqueIndex('serials_tenant_id_installation_uq').on(t.tenantId, t.id, t.installationId),
    foreignKey({
      name: 'serials_tenant_company_fk',
      columns: [t.tenantId, t.companyId],
      foreignColumns: [companies.tenantId, companies.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'serials_tenant_family_fk',
      columns: [t.tenantId, t.familyId],
      foreignColumns: [machineFamilies.tenantId, machineFamilies.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'serials_tenant_model_family_fk',
      columns: [t.tenantId, t.modelId, t.familyId],
      foreignColumns: [machineModels.tenantId, machineModels.id, machineModels.familyId],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'serials_tenant_installation_company_fk',
      columns: [t.tenantId, t.installationId, t.companyId],
      foreignColumns: [installations.tenantId, installations.id, installations.companyId],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
  ],
);

export type SerialRow = typeof serials.$inferSelect;
export type NewSerialRow = typeof serials.$inferInsert;
