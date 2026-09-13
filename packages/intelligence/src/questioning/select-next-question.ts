import { z } from 'zod';
import { canEmitProcedureRemotely, type PlaybookStep } from '@argoniq/core-domain';
import { type RankedCause } from '../diagnosis/rank-causes.js';

/**
 * Select the next safe diagnostic question by expected information gain.
 *
 * Pick the next question that maximally discriminates among the current top
 * causes, subject to a hard safety filter (SELECT_QUESTION). MVP uses a
 * simple, explainable discriminating-power heuristic over a step's
 * `discriminatesCauseKeys` rather than full entropy math — kept deliberately
 * reviewable ("we start with authored branching").
 *
 * Safety filter : RED-zone questions are never asked remotely;
 * YELLOW questions are eligible only when their preconditions are verified. If
 * the best remaining discriminator is RED-only, there is no askable question and
 * the caller must escalate (cond. 1).
 */

/** How much current belief mass a step would split — higher means more informative. */
export const SelectNextQuestionInput = z.object({
  /** Candidate `question`/`check` steps from the active playbook. */
  steps: z.array(z.custom<PlaybookStep>()),
  /** Current ranked posteriors (non-eliminated causes carry the live belief mass). */
  rankedCauses: z.array(z.custom<RankedCause>()),
  /** Questions already asked, by step key, so we never repeat one. */
  askedStepKeys: z.array(z.string()).default([]),
  /**
   * Whether YELLOW preconditions are verified for THIS interaction. Until then,
   * YELLOW steps are filtered out exactly like RED (default-to-safe).
   */
  preconditionsVerified: z.boolean().default(false),
});
export type SelectNextQuestionInput = z.infer<typeof SelectNextQuestionInput>;

export type SelectedQuestion =
  | { readonly kind: 'question'; readonly step: PlaybookStep; readonly informationGain: number }
  | {
      /**
       * No askable, discriminating question remains. `reason` lets the caller route:
       *  - `no_safe_question`: the only discriminators were RED/unverified-YELLOW → escalate.
       *  - `no_discriminator`: remaining questions split nothing → stop questioning.
       */
      readonly kind: 'none';
      readonly reason: 'no_safe_question' | 'no_discriminator';
    };

/**
 * Discriminating power of a step over the live belief: the share of current
 * posterior mass that sits on the causes the step can distinguish. A step that
 * touches causes holding ~half the mass is maximally informative; one whose
 * causes hold ~all or ~none of the mass tells us nothing. We score by how close
 * the touched mass is to 0.5 (peak information), matching the  heuristic.
 */
export function informationGain(step: PlaybookStep, rankedCauses: readonly RankedCause[]): number {
  const keys = new Set(step.discriminatesCauseKeys);
  if (keys.size === 0) return 0;

  let touchedMass = 0;
  let liveMass = 0;
  for (const cause of rankedCauses) {
    if (cause.eliminated) continue;
    liveMass += cause.posterior;
    if (keys.has(cause.key)) touchedMass += cause.posterior;
  }
  if (liveMass <= 0) return 0;

  const share = touchedMass / liveMass;
  // Peak at share = 0.5; 0 at share = 0 or 1. Equivalent to the variance of a
  // Bernoulli split, scaled to [0,1] so it reads as a clean discriminating power.
  return 4 * share * (1 - share);
}

/**
 * Select the next question by max information gain, after the safety filter.
 * Pure and deterministic (ties broken by step key for stable ordering).
 */
export function selectNextQuestion(input: SelectNextQuestionInput): SelectedQuestion {
  const { steps, rankedCauses, askedStepKeys, preconditionsVerified } =
    SelectNextQuestionInput.parse(input);

  const asked = new Set(askedStepKeys);

  // A step is askable only if it is a question/check, not already asked, and its
  // zone may be emitted remotely (RED never; YELLOW only with verified preconditions).
  const askable = steps.filter(
    (s) =>
      (s.kind === 'question' || s.kind === 'check') &&
      !asked.has(s.key) &&
      canEmitProcedureRemotely(s.safetyZone, preconditionsVerified),
  );

  // Were there discriminating questions we had to drop purely for safety? If so,
  // signal `no_safe_question` so the caller escalates rather than stops blind.
  const safetyBlockedDiscriminator = steps.some(
    (s) =>
      (s.kind === 'question' || s.kind === 'check') &&
      !asked.has(s.key) &&
      !canEmitProcedureRemotely(s.safetyZone, preconditionsVerified) &&
      informationGain(s, rankedCauses) > 0,
  );

  let best: { step: PlaybookStep; gain: number } | undefined;
  for (const step of askable) {
    const gain = informationGain(step, rankedCauses);
    if (gain <= 0) continue;
    if (!best || gain > best.gain || (gain === best.gain && step.key < best.step.key)) {
      best = { step, gain };
    }
  }

  if (best) {
    return { kind: 'question', step: best.step, informationGain: best.gain };
  }
  if (safetyBlockedDiscriminator) {
    return { kind: 'none', reason: 'no_safe_question' };
  }
  return { kind: 'none', reason: 'no_discriminator' };
}
