import { z } from 'zod';
import { CompanyId, DocumentId, KnowledgeTier, SerialId, TenantId } from '@argoniq/core-domain';

/**
 * Provenance token (gate 3) — the output-side isolation control.
 *
 * Every fact or citation the AI emits carries one of these. Before any output is
 * delivered, the governance layer asserts the token's scope matches the
 * requester: `tenantId` must match always; for T2 (customer-specific) the
 * `companyId`/`serialId` scope must match too. A mismatch hard-blocks the
 * output — isolation is enforced deterministically on the output, NOT by a
 * similarity heuristic.
 */
export const ProvenanceToken = z.object({
  tenantId: TenantId,
  tier: KnowledgeTier,
  documentId: DocumentId.optional(),
  /** Required scope for T2 (customer-specific) artifacts. */
  companyId: CompanyId.optional(),
  serialId: SerialId.optional(),
  /** Deterministic page provenance for citations (text-only). */
  page: z.number().int().positive().optional(),
});
export type ProvenanceToken = z.infer<typeof ProvenanceToken>;

/** The requester scope a provenance token is checked against. */
export type RequesterScope = {
  readonly tenantId: TenantId;
  readonly companyId?: CompanyId;
  readonly serialId?: SerialId;
};

/**
 * Pure predicate: does this provenance token belong to the requester?
 *
 * - Tenant must always match.
 * - T2 artifacts must match the requester's customer scope (and serial if the
 *   token is serial-scoped). T1 is tenant-wide. T3/T4 must never be emitted to a
 *   customer at all (that is gate 2, enforced earlier by the two-channel design).
 *
 * Returns false on any uncertainty — default-deny.
 */
export function provenanceMatchesRequester(token: ProvenanceToken, scope: RequesterScope): boolean {
  if (token.tenantId !== scope.tenantId) return false;

  if (token.tier === 'T2') {
    if (token.companyId && token.companyId !== scope.companyId) return false;
    // Fail-closed on serial scope: a serial-scoped token may be emitted ONLY when
    // the requester is scoped to that same serial. An absent requester serial is a
    // mismatch (deny) — otherwise an account-level customer could be shown a T2
    // fact belonging to a *different* serial they own (cross-serial leak, gate 3).
    if (token.serialId && token.serialId !== scope.serialId) return false;
    // A T2 token with no customer scope is malformed — deny.
    if (!token.companyId) return false;
  }

  return true;
}
