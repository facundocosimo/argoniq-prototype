import { char, index, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { pk, tenantId, timestamps } from './_shared.js';
import { companies } from './companies.js';
import { tenants } from './tenants.js';

/** Physical customer locations where serials are installed. Tenant-scoped (RLS). */
export const sites = pgTable(
  'sites',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    countryCode: char('country_code', { length: 2 }),
    timezone: varchar('timezone', { length: 64 }),
    ...timestamps(),
  },
  (t) => [index('sites_tenant_idx').on(t.tenantId), index('sites_company_idx').on(t.companyId)],
);

export type SiteRow = typeof sites.$inferSelect;
export type NewSiteRow = typeof sites.$inferInsert;
