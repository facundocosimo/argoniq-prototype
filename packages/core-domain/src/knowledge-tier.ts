import { z } from 'zod';

/**
 * Knowledge tiers  — the governance backbone.
 *
 * A tier is assigned to every knowledge artifact *by ingestion channel*, never
 * inferred (step 1: "tier-by-channel makes the worst leak
 * structurally impossible"). The tier determines whether the AI may quote the
 * artifact to a customer, and whether it may even reason over it.
 *
 *  - T1  Company-visible       — manuals, public spec sheets. Citable to companies.
 *  - T2  Company-specific      — that customer's own config/history. Citable to *that* customer/serial only.
 *  - T3  Internal support       — service bulletins, root-cause notes. Reason over it; never quote it.
 *  - T4  Restricted             — margins, supplier cost, legal. Credential-isolated; the answer service has no access.
 *
 * This enum is the same governance model the permission engine enforces
 * : what a user may see and what the AI may surface derive from
 * one policy, never duplicated logic.
 */
export const KNOWLEDGE_TIERS = ['T1', 'T2', 'T3', 'T4'] as const;

export const KnowledgeTier = z.enum(KNOWLEDGE_TIERS);
export type KnowledgeTier = z.infer<typeof KnowledgeTier>;

/** Tiers the AI is permitted to quote/paraphrase verbatim to a customer. */
const CUSTOMER_CITABLE_TIERS = new Set<KnowledgeTier>(['T1', 'T2']);

/** True when an artifact at this tier may appear in customer-facing text. */
export function isCustomerCitable(tier: KnowledgeTier): boolean {
  return CUSTOMER_CITABLE_TIERS.has(tier);
}

/**
 * True when an artifact may enter the *customer generation channel* at all.
 * Mirrors `isCustomerCitable`: the two-channel design (step 5)
 * physically excludes T3/T4 from the customer context, so T3 can never be
 * paraphrased. T3 is reasoned over only in the internal channel.
 */
export function isInCustomerChannel(tier: KnowledgeTier): boolean {
  return isCustomerCitable(tier);
}

/** True for tiers requiring credential-isolated storage (separate index/role). */
export function isCredentialIsolated(tier: KnowledgeTier): boolean {
  return tier === 'T4';
}
