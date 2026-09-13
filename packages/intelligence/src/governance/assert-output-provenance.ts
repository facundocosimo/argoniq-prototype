import { z } from 'zod';
import {
  provenanceMatchesRequester,
  type ProvenanceToken,
  type RequesterScope,
} from '@argoniq/contracts';
import { TenantIsolationError } from '@argoniq/observability';

/**
 * Block output whose provenance does not match the requester scope.
 *
 * Cross-tenant / cross-customer isolation is enforced **deterministically on the
 * OUTPUT side**, not by a similarity heuristic. Every emitted fact or citation
 * carries a `ProvenanceToken`; before delivery, each token's scope must match the
 * requester (tenant always; customer/serial for T2), or the whole output is
 * hard-blocked. This is gate 3 of  — pass/fail, zero tolerance, never averaged.
 *
 * On any mismatch this throws `TenantIsolationError` (which is `expose = false` —
 * the message never reaches the client; the incident is reconstructable from the
 * audit log via correlationId). The check delegates the per-token predicate to
 * `provenanceMatchesRequester` (contracts) so the isolation logic lives in one
 * place and is never re-implemented.
 */

/** One emitted token to be checked against the requester scope before delivery. */
export const EmittedToken = z.object({
  /** Stable id of the emitted fact/citation, for the audit trail on a block. */
  tokenId: z.string().min(1),
  provenance: z.custom<ProvenanceToken>(),
});
export type EmittedToken = z.infer<typeof EmittedToken>;

/**
 * Assert that every emitted token belongs to the requester. Throws
 * `TenantIsolationError` (not exposed) on the FIRST mismatch, naming the
 * offending tokenId in `details` for the audit log. Returns nothing on success.
 *
 * @param emittedTokens - provenance tokens for every fact/citation in the output.
 * @param requesterScope - the authenticated requester's tenant (and T2 scope).
 */
export function assertOutputProvenance(
  emittedTokens: readonly EmittedToken[],
  requesterScope: RequesterScope,
): void {
  for (const token of emittedTokens) {
    const checked = EmittedToken.parse(token);
    if (!provenanceMatchesRequester(checked.provenance, requesterScope)) {
      throw new TenantIsolationError('Provenance scope does not match the requester', {
        details: {
          tokenId: checked.tokenId,
          tier: checked.provenance.tier,
        },
      });
    }
  }
}
