import { z } from 'zod';
import { CompanyId, Role, TenantId, UserId } from '@argoniq/core-domain';

/**
 * The authenticated principal. Resolved once per entry point from the session +
 * the user's membership, then carried in the ServiceContext. It is the sole
 * input to the policy engine — there is no other source of "who is asking".
 */
export const Actor = z.object({
  userId: UserId,
  tenantId: TenantId,
  role: Role,
  /** Present for customer-space roles (site_admin, operator); absent for OEM staff. */
  companyId: CompanyId.optional(),
});
export type Actor = z.infer<typeof Actor>;

/** Shape of a membership row as read from the DB (loose — validated on the way in). */
export type MembershipLike = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: string;
  readonly companyId: string | null;
};

/**
 * Build a validated Actor from a membership row. Branding/validation happens here
 * so everything downstream can trust the Actor. Throws if the row is malformed.
 */
export function actorFromMembership(membership: MembershipLike): Actor {
  return Actor.parse({
    userId: membership.userId,
    tenantId: membership.tenantId,
    role: membership.role,
    ...(membership.companyId ? { companyId: membership.companyId } : {}),
  });
}
