import { TenantId, UserId, roleSpaceOf } from '@argoniq/core-domain';
import { Actor as ActorSchema, type Actor } from './actor.js';
import { type Principal } from './principal.js';

export type OrganizationMembership = {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly role: Actor['role'];
  readonly companyId: string | null;
  /** Display context from the same tenant-scoped lookup that validates ownership. */
  readonly companyName: string | null;
};
export type StoredMembership = OrganizationMembership & { readonly state: 'active' | 'suspended' };

export function activeMemberships(
  rows: readonly StoredMembership[],
): readonly OrganizationMembership[] {
  return rows.filter((row) => row.state === 'active');
}

export function resolveSelectedMembership(
  rows: readonly OrganizationMembership[],
  requestedTenantId: string | undefined,
): OrganizationMembership | null {
  if (requestedTenantId) return rows.find((row) => row.tenantId === requestedTenantId) ?? null;
  return rows.length === 1 ? (rows[0] ?? null) : null;
}

export function principalForMembership(
  userId: string,
  membership: OrganizationMembership,
): Extract<Principal, { kind: 'tenant' }> {
  const requiresCustomer = roleSpaceOf(membership.role) === 'customer';
  if (requiresCustomer !== Boolean(membership.companyId))
    throw new Error('Membership has an invalid customer scope.');
  return {
    kind: 'tenant',
    actor: ActorSchema.parse({
      userId: UserId.parse(userId),
      tenantId: TenantId.parse(membership.tenantId),
      role: membership.role,
      ...(membership.companyId ? { companyId: membership.companyId } : {}),
    }),
  };
}
