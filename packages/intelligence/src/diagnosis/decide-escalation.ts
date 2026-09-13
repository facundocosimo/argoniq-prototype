import { z } from 'zod';
import {
  type AnswerMode,
  type ConfidenceBand,
  classifyConfidence,
  ESCALATION_POLICY,
  type SafetyZone,
} from '@argoniq/core-domain';
import { type RankedPosteriors } from './rank-causes.js';

/**
 * Apply the configured confidence and safety thresholds after cause ranking.
 * Thresholds come from `ESCALATION_POLICY` so callers cannot drift from the shared
 * policy. Safety, source, configuration, and fleet signals may force escalation;
 * they never promote an answer to automatic resolution.
 */

/** Why the decision escalated, recorded for audit and handoff. */
export const ESCALATION_REASONS = [
  'low_confidence',
  'ambiguous_tie',
  'red_zone',
  'not_source_backed',
  'unsafe_zone_for_autosend',
  'source_conflict',
  'config_uncertain',
  'fleet_hold',
] as const;
export const EscalationReason = z.enum(ESCALATION_REASONS);
export type EscalationReason = z.infer<typeof EscalationReason>;

/** Signals outside the confidence calculation that may require escalation. */
export const DecideEscalationOptions = z.object({
  /** Deterministic safety zone (from the safety layer; the LLM never decides it). */
  zone: z.custom<SafetyZone>(),
  /** True iff the top cause is backed by a citable T1/T2 source or approved step. */
  sourceBacked: z.boolean(),
  /** True iff a YELLOW check's preconditions are verified (power off, depressurized…). */
  preconditionsVerified: z.boolean().default(false),
  /** Whether any cited source is outdated, superseded, or conflicting. */
  sourceConflict: z.boolean().default(false),
  /** Whether the recommendation depends on uncertain configuration data. */
  configUncertain: z.boolean().default(false),
  /** Whether the symptom matches a fleet issue still under investigation. */
  openFleetCluster: z.boolean().default(false),
  /** Questions asked so far; budget exhaustion forces escalation. */
  questionsAsked: z.number().int().nonnegative().default(0),
});
export type DecideEscalationOptions = z.infer<typeof DecideEscalationOptions>;

/** Whether further diagnosis is still allowed (budget left), used by the caller's loop. */
export type EscalationDisposition =
  | {
      /** top ≥ 0.75, all auto-resolve gates pass: answer directly. */
      readonly outcome: 'auto_resolve';
      readonly answerMode: Extract<AnswerMode, 'A' | 'B'>;
      readonly confidence: ConfidenceBand;
      readonly topScore: number;
    }
  | {
      /** 0.60 ≤ top < 0.75 (or High not source-backed-yet) and budget remains: keep diagnosing. */
      readonly outcome: 'recommend';
      readonly answerMode: Extract<AnswerMode, 'C'>;
      readonly confidence: ConfidenceBand;
      readonly topScore: number;
      readonly budgetRemaining: number;
    }
  | {
      /** Any escalate condition, or budget exhausted: structured handoff. */
      readonly outcome: 'escalate';
      readonly answerMode: Extract<AnswerMode, 'E'>;
      readonly confidence: ConfidenceBand;
      readonly topScore: number;
      readonly reasons: readonly EscalationReason[];
    };

/**
 * Return a deterministic disposition. All escalation reasons are collected for
 * audit before considering automatic resolution or another diagnostic question.
 */
export function decideEscalation(
  posteriors: RankedPosteriors,
  options: DecideEscalationOptions,
): EscalationDisposition {
  const opts = DecideEscalationOptions.parse(options);
  const top = posteriors.topScore;
  const band = classifyConfidence(top);

  // 1. Hard escalate triggers — independent; any one is sufficient. Collect all
  //    for the audit trail (do not short-circuit).
  const reasons: EscalationReason[] = [];
  if (top < ESCALATION_POLICY.ESCALATE_FLOOR) reasons.push('low_confidence');
  if (posteriors.margin < ESCALATION_POLICY.TIE_MARGIN) reasons.push('ambiguous_tie');
  if (opts.zone === 'RED') reasons.push('red_zone');
  if (opts.sourceConflict) reasons.push('source_conflict');
  if (opts.configUncertain) reasons.push('config_uncertain');
  if (opts.openFleetCluster) reasons.push('fleet_hold');

  if (reasons.length > 0) {
    return { outcome: 'escalate', answerMode: 'E', confidence: band, topScore: top, reasons };
  }

  // 2. Auto-resolution requires high confidence, source support, and an eligible
  //    safety zone. Otherwise the result falls through to recommend or escalate.
  const isHigh = top >= ESCALATION_POLICY.AUTO_RESOLVE_MIN;
  const zoneEmittable =
    opts.zone === 'GREEN' || (opts.zone === 'YELLOW' && opts.preconditionsVerified);

  if (isHigh && opts.sourceBacked && zoneEmittable) {
    // GREEN → direct cited answer (Mode A); precondition-verified YELLOW → guided check (Mode B).
    const answerMode: Extract<AnswerMode, 'A' | 'B'> = opts.zone === 'GREEN' ? 'A' : 'B';
    return { outcome: 'auto_resolve', answerMode, confidence: 'HIGH', topScore: top };
  }

  // 3. Not auto-resolvable. If we still have question budget, keep diagnosing
  //    (Mode C recommendation, not customer auto-send). Otherwise escalate —
  //    non-convergence / High-but-ungrounded both route to a structured case.
  const budgetRemaining = ESCALATION_POLICY.QUESTION_BUDGET - opts.questionsAsked;
  if (budgetRemaining > 0) {
    return {
      outcome: 'recommend',
      answerMode: 'C',
      confidence: band,
      topScore: top,
      budgetRemaining,
    };
  }

  const exhaustedReasons: EscalationReason[] = [];
  if (isHigh && !opts.sourceBacked) exhaustedReasons.push('not_source_backed');
  if (isHigh && opts.sourceBacked && !zoneEmittable) {
    exhaustedReasons.push('unsafe_zone_for_autosend');
  }
  if (!isHigh) exhaustedReasons.push('low_confidence');
  return {
    outcome: 'escalate',
    answerMode: 'E',
    confidence: band,
    topScore: top,
    reasons: exhaustedReasons,
  };
}
