import { index, pgEnum, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { pk, tenantId, timestamps } from './_shared.js';
import { companies } from './companies.js';
import { tenants } from './tenants.js';

/** Role enum — mirrors the canon roles (@argoniq/core-domain). */
export const memberRoleEnum = pgEnum('member_role', [
  'support_technician',
  'spare_parts',
  'field_engineer',
  'documentation',
  'support_manager',
  'admin',
  'site_admin',
  'operator',
]);

/** A suspended membership loses access immediately; it is never an inactive session. */
export const membershipStateEnum = pgEnum('membership_state', ['active', 'suspended']);

/**
 * Memberships bind a user (Better Auth `user.id`, referenced loosely as a UUID)
 * to a tenant with a role. Company-space roles also carry a `companyId` scope.
 * This is the input the centralized policy engine reads  — it is
 * NOT a parallel permission system. Tenant-scoped (RLS).
 */
export const memberships = pgTable(
  'memberships',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    role: memberRoleEnum('role').notNull(),
    state: membershipStateEnum('state').notNull().default('active'),
    /** Required for customer-space roles (site_admin, operator); null for OEM staff. */
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    ...timestamps(),
  },
  (t) => [
    index('memberships_tenant_idx').on(t.tenantId),
    index('memberships_user_idx').on(t.userId),
    uniqueIndex('memberships_tenant_user_uq').on(t.tenantId, t.userId),
  ],
);

export type MembershipRow = typeof memberships.$inferSelect;
export type NewMembershipRow = typeof memberships.$inferInsert;
