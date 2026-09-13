import { index, pgTable, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { pk, tenantId, timestamps } from './_shared.js';
import { tenants } from './tenants.js';

/** Company organizations within a tenant. Tenant-scoped (RLS). */
export const companies = pgTable(
  'companies',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    ...timestamps(),
  },
  (t) => [
    index('companies_tenant_idx').on(t.tenantId),
    uniqueIndex('companies_tenant_id_uq').on(t.tenantId, t.id),
  ],
);

export type CompanyRow = typeof companies.$inferSelect;
export type NewCompanyRow = typeof companies.$inferInsert;
