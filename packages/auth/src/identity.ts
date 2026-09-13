import { type Actor, actorFromMembership } from './actor.js';

/**
 * Bridge from an authenticated session to the {@link Actor} used by authorization.
 * The caller supplies membership lookup while this package owns the conversion.
 * Authentication-provider wiring is intentionally outside this module.
 */
export type Session = {
  readonly userId: string;
  readonly tenantId: string;
};

/** Loads the membership for (userId, tenantId), or null if the user has none. */
export type MembershipLookup = (
  userId: string,
  tenantId: string,
) => Promise<{
  userId: string;
  tenantId: string;
  role: string;
  companyId: string | null;
} | null>;

/**
 * Resolve a session into an Actor. Returns null when the user is not a member of
 * the tenant — the caller treats that as unauthenticated/forbidden (default-deny).
 */
export async function resolveActor(
  session: Session,
  lookupMembership: MembershipLookup,
): Promise<Actor | null> {
  const membership = await lookupMembership(session.userId, session.tenantId);
  if (!membership) return null;
  return actorFromMembership(membership);
}
