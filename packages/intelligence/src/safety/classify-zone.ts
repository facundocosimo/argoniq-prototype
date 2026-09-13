import { z } from 'zod';
import { escalateZone, type SafetyZone } from '@argoniq/core-domain';

/**
 * The shared rule and input schema live in core-domain and are re-exported here.
 * This module reconciles a model suggestion with that rule; the model may make
 * the result more restrictive, never less.
 */
export { SafetyContext, classifyZone } from '@argoniq/core-domain';

/**
 * Suggestion from the LLM. It may only ever *raise* the zone; the rule's verdict
 * is the floor. This type exists to make the asymmetry explicit at call sites.
 */
export const SuggestedZone = z.custom<SafetyZone>();
export type SuggestedZone = SafetyZone;

/** Keep the more restrictive of the rule result and the model suggestion. */
export function reconcileSuggestedZone(ruleZone: SafetyZone, suggested: SuggestedZone): SafetyZone {
  return escalateZone(ruleZone, suggested);
}
