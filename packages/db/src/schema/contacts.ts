import { boolean, index, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { contactRoleEnum, pk, tenantId, timestamps } from './_shared.js';
import { companies } from './companies.js';
import { sites } from './sites.js';
import { tenants } from './tenants.js';

/**
 * Contacts — the people at a customer (the CRM Account→Contact relationship). A
 * contact belongs to a CUSTOMER (required) and may optionally be based at one of that
 * customer's SITES (nullable siteId; NULL = a company-wide contact). one table serves
 * both the customer record (all its people) and a site record (just that site's), so
 * there is no separate site-contact model to keep in sync. Tenant-scoped (RLS).
 */
export const contacts = pgTable(
  'contacts',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    // Optional "based at" site. `set null` on site delete keeps the person on the
    // customer — a contact outlives any one location.
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 200 }).notNull(),
    /** Free-text job title, e.g. "Maintenance Manager" — distinct from `role` (the category). */
    title: varchar('title', { length: 120 }),
    role: contactRoleEnum('role').notNull().default('other'),
    email: varchar('email', { length: 320 }),
    phone: varchar('phone', { length: 40 }),
    /** The customer's primary point of contact (sorted first). At most one per customer,
     *  enforced softly by the service (setting one clears the others). */
    isPrimary: boolean('is_primary').notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    index('contacts_tenant_idx').on(t.tenantId),
    index('contacts_company_idx').on(t.companyId),
    index('contacts_site_idx').on(t.siteId),
  ],
);

export type ContactRow = typeof contacts.$inferSelect;
export type NewContactRow = typeof contacts.$inferInsert;
