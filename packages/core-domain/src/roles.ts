import { z } from 'zod';
import { type KnowledgeTier } from './knowledge-tier.js';

/**
 * Role model. Two role spaces:
 *  - OEM-staff roles (inside the tenant) — operate the platform.
 *  - Customer roles (a customer organization within the tenant) — receive support.
 *
 * Roles are inputs to the centralized policy engine (packages/auth); they are
 * NOT a parallel permission system. The role → max-visible-tier mapping below is
 * the coarse ceiling; fine-grained access (which serial, which document) is the
 * relationship/attribute check the policy engine performs on top.
 */
export const OEM_STAFF_ROLES = [
  'support_technician',
  'spare_parts',
  'field_engineer',
  'documentation',
  'support_manager',
  'admin',
] as const;

export const CUSTOMER_ROLES = ['site_admin', 'operator'] as const;

export const OemStaffRole = z.enum(OEM_STAFF_ROLES);
export type OemStaffRole = z.infer<typeof OemStaffRole>;

export const CustomerRole = z.enum(CUSTOMER_ROLES);
export type CustomerRole = z.infer<typeof CustomerRole>;

export const Role = z.union([OemStaffRole, CustomerRole]);
export type Role = z.infer<typeof Role>;

export type RoleSpace = 'oem_staff' | 'customer';

export function roleSpaceOf(role: Role): RoleSpace {
  return (OEM_STAFF_ROLES as readonly string[]).includes(role) ? 'oem_staff' : 'customer';
}

/**
 * Coarse visibility ceiling per role. Companies never exceed T2; only manager/
 * admin staff see T4. This is a *ceiling*, enforced again at the data layer by
 * RLS and credential isolation (defense in depth — never the only control).
 */
const MAX_VISIBLE_TIER: Record<Role, KnowledgeTier> = {
  // OEM staff
  support_technician: 'T3',
  spare_parts: 'T3',
  field_engineer: 'T3',
  documentation: 'T3',
  support_manager: 'T4',
  admin: 'T4',
  // Company
  site_admin: 'T2',
  operator: 'T2',
};

const TIER_RANK: Record<KnowledgeTier, number> = { T1: 1, T2: 2, T3: 3, T4: 4 };

export function maxVisibleTier(role: Role): KnowledgeTier {
  return MAX_VISIBLE_TIER[role];
}

export function roleCanSeeTier(role: Role, tier: KnowledgeTier): boolean {
  return TIER_RANK[tier] <= TIER_RANK[MAX_VISIBLE_TIER[role]];
}
