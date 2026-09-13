import { z } from 'zod';
import { isInCustomerChannel, type KnowledgeTier } from '@argoniq/core-domain';

/**
 * Build customer-facing context from sources eligible for that channel.
 *
 * The defensible core of T3/T4 non-leakage is NOT a prompt instruction — it is a
 * structural exclusion: the customer channel's context is built to *physically*
 * omit T3 and T4 sources, so the generator cannot paraphrase what was never in
 * its context ("you cannot paraphrase what was never in your context").
 *
 * `buildCustomerChannelContext` filters a mixed source list down to only the
 * tiers `isInCustomerChannel` allows (T1 + owner-scoped T2). T3 is reasoned over
 * only in the segregated internal channel (Mode D/E); T4 never enters the answer
 * path at all. This function is the choke point that makes gate 2
 * structural rather than instruction-dependent.
 */

/** A knowledge source eligible to enter a generation channel. */
export const KnowledgeSource = z.object({
  /** Stable chunk/source id used in the provenance trail and the forbidden-block check. */
  sourceId: z.string().min(1),
  tier: z.custom<KnowledgeTier>(),
  /** The retrievable text. Present so the caller can assemble a prompt context. */
  text: z.string(),
  /**
   * Per-item flag. Even a T1 chunk carrying a hazard paragraph is
   * `forbidden_for_customer_facing=true` and must be excluded from the customer
   * channel regardless of tier (chunk-level governance).
   */
  forbiddenForCustomerFacing: z.boolean().default(false),
});
export type KnowledgeSource = z.infer<typeof KnowledgeSource>;

/**
 * Build the customer-channel context by physically excluding any source that is
 * not in the customer channel by tier (T3/T4) OR is flagged
 * `forbidden_for_customer_facing`. The returned array is the ONLY text the
 * customer generator may see.
 */
export function buildCustomerChannelContext(
  sources: readonly KnowledgeSource[],
): readonly KnowledgeSource[] {
  return sources
    .map((s) => KnowledgeSource.parse(s))
    .filter((s) => isInCustomerChannel(s.tier) && !s.forbiddenForCustomerFacing);
}
