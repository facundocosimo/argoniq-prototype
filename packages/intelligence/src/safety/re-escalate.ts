import { z } from 'zod';
import { escalateZone, type SafetyZone } from '@argoniq/core-domain';

/**
 * Evidence-triggered hazard re-classification (Stage 7).
 *
 * If any answer or photo reveals a hazard cue — solvent/fuel smell, audible or
 * visible pressurized leak, smoke, heat, exposed conductor — the case
 * **immediately re-escalates its zone, overriding the branch's prior zone**. The
 * zone attaches to the *current evidence*, not only the originating check.
 *
 * The override is enforced by `escalateZone` (monotonic): re-escalation can only
 * raise the zone, never lower it. A benign cue therefore cannot relax an
 * already-RED branch — exactly the safety invariant  requires.
 */

/** Hazard cues that force re-escalation, with the zone each cue implies. */
export const HAZARD_CUES = {
  solvent_or_fuel_smell: 'RED',
  pressurized_leak: 'RED',
  smoke: 'RED',
  excessive_heat: 'RED',
  exposed_conductor: 'RED',
  audible_arcing: 'RED',
  /** A bounded, low-energy ambiguity (e.g. a faint unexplained noise) — caution, not stop. */
  unexplained_minor_noise: 'YELLOW',
} as const satisfies Record<string, SafetyZone>;

export const HazardCue = z.enum(
  Object.keys(HAZARD_CUES) as [keyof typeof HAZARD_CUES, ...(keyof typeof HAZARD_CUES)[]],
);
export type HazardCue = z.infer<typeof HazardCue>;

export const ReEscalateInput = z.object({
  /** The branch's zone before this evidence arrived. */
  currentZone: z.custom<SafetyZone>(),
  /** Hazard cues detected in the latest answer/photo. */
  cues: z.array(HazardCue).default([]),
});
export type ReEscalateInput = z.infer<typeof ReEscalateInput>;

/**
 * Fold every detected cue into the current zone via `escalateZone`. Pure and
 * monotonic — the result is never lower than `currentZone`.
 */
export function reEscalateOnEvidence(input: ReEscalateInput): SafetyZone {
  const { currentZone, cues } = ReEscalateInput.parse(input);
  return cues.reduce<SafetyZone>((zone, cue) => escalateZone(zone, HAZARD_CUES[cue]), currentZone);
}
