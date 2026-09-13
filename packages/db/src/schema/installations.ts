import {
  type AnyPgColumn,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { installationKindEnum, pk, serialStatusEnum, tenantId, timestamps } from './_shared.js';
import { companies } from './companies.js';
import { sites } from './sites.js';
import { tenants } from './tenants.js';

/**
 * Installations — the composition axis (installations & asset hierarchy). A
 * functional-location node (ISA-95 / EAM standard) that groups equipment sold as
 * one system: a production line, a cell, a skid. Self-nesting (`parentId`) so a
 * line can contain cells. Equipment (serials) hang off a node via
 * `serials.installationId`; a null there means a STANDALONE machine — no wrapper
 * row is created for the common single-machine case. Tenant-scoped (RLS).
 */
export const installations = pgTable(
  'installations',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').notNull(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'restrict' }),
    /** Self-reference for line → cell nesting. Null = a top-level installation. */
    parentId: uuid('parent_id').references((): AnyPgColumn => installations.id, {
      onDelete: 'set null',
    }),
    kind: installationKindEnum('kind').notNull().default('line'),
    key: varchar('key', { length: 63 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    commissionedAt: timestamp('commissioned_at', { withTimezone: true }),
    warrantyExpiresAt: timestamp('warranty_expires_at', { withTimezone: true }),
    status: serialStatusEnum('status').notNull().default('active'),
    ...timestamps(),
  },
  (t) => [
    index('installations_tenant_idx').on(t.tenantId),
    index('installations_company_idx').on(t.companyId),
    index('installations_site_idx').on(t.siteId),
    index('installations_parent_idx').on(t.parentId),
    uniqueIndex('installations_tenant_key_uq').on(t.tenantId, t.key),
    uniqueIndex('installations_tenant_id_company_uq').on(t.tenantId, t.id, t.companyId),
    foreignKey({
      name: 'installations_tenant_company_fk',
      columns: [t.tenantId, t.companyId],
      foreignColumns: [companies.tenantId, companies.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
  ],
);

export type InstallationRow = typeof installations.$inferSelect;
export type NewInstallationRow = typeof installations.$inferInsert;
