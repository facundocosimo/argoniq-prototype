import { pgTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { pk, timestamps } from './_shared.js';

/**
 * Tenants (OEMs) — the root of the isolation hierarchy. This table is itself NOT
 * tenant-scoped (it defines the tenants); access to it is restricted to platform
 * operations, never customer surfaces.
 */
export const tenants = pgTable(
  'tenants',
  {
    id: pk(),
    slug: varchar('slug', { length: 63 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    brandAccentColor: varchar('brand_accent_color', { length: 7 }),
    region: varchar('region', { length: 64 }).notNull().default('eu-central-1'),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('tenants_slug_uq').on(t.slug)],
);

export type TenantRow = typeof tenants.$inferSelect;
export type NewTenantRow = typeof tenants.$inferInsert;
