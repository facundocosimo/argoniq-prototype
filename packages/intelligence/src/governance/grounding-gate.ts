import { z } from 'zod';
import { type Result, ok, err } from '@argoniq/contracts';
import { isCustomerCitable, type KnowledgeTier } from '@argoniq/core-domain';

/**
 * Verify that customer-facing technical claims have an eligible source.
 *
 * The last gate before the customer sees text. Even with a closed candidate set
 * and a T3-free channel, the phrasing layer is an LLM and can imply unsupported
 * certainty. The deterministic rule: **every customer-facing technical claim must
 * bind to a citable T1/T2 source or an approved playbook step**, else the answer
 * is downgraded ( step 2 /  "grounding check, MVP, deterministic").
 *
 * Returns a `Result` rather than throwing: an ungrounded claim is an *expected*
 * outcome the caller branches on (downgrade to Mode C/E), not an exception. The
 * downgrade payload is shaped like the `GroundingFailedError` envelope so an
 * adapter can map it consistently — but the gate itself stays pure.
 */

/**
 * A citation handle attached to a claim, resolving to a source the gate can check
 * against its tier. `approvedPlaybookStep` is the non-document binding ( * "T1/T2 or approved playbook step").
 */
export const CitationBinding = z.union([
  z.object({
    kind: z.literal('source'),
    sourceId: z.string().min(1),
    tier: z.custom<KnowledgeTier>(),
  }),
  z.object({ kind: z.literal('approvedPlaybookStep'), stepKey: z.string().min(1) }),
]);
export type CitationBinding = z.infer<typeof CitationBinding>;

/** One atomic technical claim extracted from the drafted message ( step 1). */
export const CustomerClaim = z.object({
  /** Stable id of the claim for the audit trail. */
  claimId: z.string().min(1),
  /** True iff this sentence makes a *technical* assertion needing grounding. */
  isTechnical: z.boolean().default(true),
  /** Citation bindings the drafter attached to this claim (may be empty). */
  citations: z.array(CitationBinding).default([]),
});
export type CustomerClaim = z.infer<typeof CustomerClaim>;

/** The downgrade reason when grounding fails (shaped for GroundingFailedError mapping). */
export type GroundingDowngrade = {
  readonly code: 'GROUNDING_FAILED';
  /** Claims that could not be bound to a citable source or approved step. */
  readonly unboundClaimIds: readonly string[];
  /** Whether the recommended fallback is a hedged recommendation (C) or a serviceCase (E). */
  readonly downgradeTo: 'C' | 'E';
};

/** A single technical claim is grounded iff it binds to a T1/T2 citation OR an approved step. */
function isClaimGrounded(claim: CustomerClaim): boolean {
  if (!claim.isTechnical) return true;
  return claim.citations.some((c) =>
    c.kind === 'approvedPlaybookStep' ? true : isCustomerCitable(c.tier),
  );
}

/**
 * Run the grounding gate over the drafted message's claims.
 *
 * - Every technical claim grounded → `ok(claims)` (the message may proceed).
 * - Any unbound technical claim → `err(downgrade)`. The caller strips/downgrades:
 *   one or two unbound claims → hedge to Mode C; many (at least half) → route to Mode E.
 *
 * Deterministic: this enforces the binding mechanically rather than trusting the
 * model (a tripwire-free, exact-match check, not a similarity heuristic).
 */
export function groundingGate(
  claims: readonly CustomerClaim[],
): Result<readonly CustomerClaim[], GroundingDowngrade> {
  const parsed = claims.map((c) => CustomerClaim.parse(c));
  const technical = parsed.filter((c) => c.isTechnical);
  const unbound = technical.filter((c) => !isClaimGrounded(c)).map((c) => c.claimId);

  if (unbound.length === 0) return ok(parsed);

  // If most technical claims are ungrounded the answer has no spine — escalate;
  // a small number can be hedged away into a recommendation.
  const downgradeTo: 'C' | 'E' =
    technical.length > 0 && unbound.length * 2 >= technical.length ? 'E' : 'C';

  return err({ code: 'GROUNDING_FAILED', unboundClaimIds: unbound, downgradeTo });
}
