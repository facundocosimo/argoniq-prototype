import { z } from 'zod';

/**
 * Safety zones. A *deterministic* rule decides the zone;
 * the LLM may only *suggest* one. The zone gates which answer modes are allowed.
 *
 *  - GREEN   informational / no-energy observation. Safe to answer directly.
 *  - YELLOW  genuinely low-energy, reversible, NO stored energy (e.g. "is the
 *            lamp lit?", "what does the HMI show?"). Allowed only with explicit
 *            verified preconditions.
 *  - RED     any stored/residual energy, pressurized lines/accumulators, hot
 *            surfaces, suspended loads, live electrical, interlock/LOTO. For
 *            remote chat this is ALWAYS escalate — never a gated-YELLOW behind a
 *            chat-typed acknowledgment.
 *
 * Hard rules encoded here:
 *  - Default-to-RED on any novel/uncertain hazard or unverifiable precondition.
 *  - Energy-bearing ⇒ RED (never gated-YELLOW).
 *  - Evidence-triggered re-escalation: a hazard cue overrides a prior lower zone
 *    (the override direction is enforced by `escalateZone`, which is monotonic).
 */
export const SAFETY_ZONES = ['GREEN', 'YELLOW', 'RED'] as const;

export const SafetyZone = z.enum(SAFETY_ZONES);
export type SafetyZone = z.infer<typeof SafetyZone>;

const ZONE_SEVERITY: Record<SafetyZone, number> = { GREEN: 0, YELLOW: 1, RED: 2 };

/** The conservative default whenever a zone cannot be determined with certainty. */
export const DEFAULT_ZONE: SafetyZone = 'RED';

/**
 * Monotonic re-escalation. Returns the MORE severe of two
 * zones, so new hazard evidence can only ever raise the zone, never lower it.
 */
export function escalateZone(current: SafetyZone, evidence: SafetyZone): SafetyZone {
  return ZONE_SEVERITY[evidence] > ZONE_SEVERITY[current] ? evidence : current;
}

/**
 * Whether a step-by-step procedure may be emitted to a *remote* customer for
 * this zone. RED is never emittable remotely; YELLOW requires preconditions to
 * have been explicitly verified upstream (the caller asserts `preconditionsVerified`).
 */
export function canEmitProcedureRemotely(
  zone: SafetyZone,
  preconditionsVerified: boolean,
): boolean {
  if (zone === 'GREEN') return true;
  if (zone === 'YELLOW') return preconditionsVerified;
  return false;
}

export const SAFETY_ZONE_LABELS: Record<SafetyZone, string> = {
  GREEN: 'Safe to proceed',
  YELLOW: 'Caution — verify preconditions',
  RED: 'Stop — requires a technician',
};
