/**
 * The shared shape every  gate emits. Gates are PASS/FAIL: a gate either
 * returns zero violations (pass) or one or more (fail). Counts are reported raw
 * and never averaged  — one violation blocks release.
 */

export const GATE_IDS = ['unsafe-advice', 'tier-leakage', 'cross-tenant'] as const;
export type GateId = (typeof GATE_IDS)[number];

export type GateViolation = {
  /** Which gate caught it. */
  readonly gate: GateId;
  /** The offending scenario. */
  readonly scenarioId: string;
  /** Human-readable reason, surfaced in the CI report. */
  readonly reason: string;
};
