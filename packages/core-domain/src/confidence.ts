import { z } from 'zod';

/**
 * Confidence representation & the single escalation gate.
 *
 * At MVP, confidence is *ordinal* — High / Medium / Low — honest ordering, not
 * statistical calibration. Internal numeric posteriors drive the engine and the
 * STAFF-facing case; customer surfaces show bands only, never a raw decimal.
 * The band↔numeric mapping is active only post-calibration.
 */
export const CONFIDENCE_BANDS = ['HIGH', 'MEDIUM', 'LOW'] as const;

export const ConfidenceBand = z.enum(CONFIDENCE_BANDS);
export type ConfidenceBand = z.infer<typeof ConfidenceBand>;

/** A numeric posterior in [0, 1] used internally by the engine, logs, and staff serviceCase bodies. */
export const ConfidenceScore = z.number().min(0).max(1);
export type ConfidenceScore = z.infer<typeof ConfidenceScore>;

/**
 * The escalation gate — a *floor, not a tunable dial*.
 * A family may raise the auto-resolve bar; it may never lower the escalate floor.
 */
export const ESCALATION_POLICY = {
  /** Below this top-cause posterior ⇒ escalate (Mode E/F). */
  ESCALATE_FLOOR: 0.6,
  /** At/above this, and source-backed in a safe zone ⇒ eligible for customer auto-send. */
  AUTO_RESOLVE_MIN: 0.75,
  /** Top-two causes within this margin ⇒ escalate (ambiguous). */
  TIE_MARGIN: 0.1,
  /** Max discriminating questions before forced escalation. */
  QUESTION_BUDGET: 5,
} as const;

/** Band↔numeric mapping (active only post-calibration): High ≥ 0.75 · Medium 0.60–0.74 · Low < 0.60. */
export function classifyConfidence(score: ConfidenceScore): ConfidenceBand {
  if (score >= ESCALATION_POLICY.AUTO_RESOLVE_MIN) return 'HIGH';
  if (score >= ESCALATION_POLICY.ESCALATE_FLOOR) return 'MEDIUM';
  return 'LOW';
}

export const CONFIDENCE_BAND_LABELS: Record<ConfidenceBand, string> = {
  HIGH: 'High confidence',
  MEDIUM: 'Medium confidence',
  LOW: 'Low confidence',
};
