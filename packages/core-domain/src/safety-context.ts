import { z } from 'zod';
import { DEFAULT_ZONE, type SafetyZone } from './safety-zone.js';

/**
 * Inputs to the deterministic safety classification. These flags come from the
 * selected playbook step and resolved machine configuration, not from the model.
 */
export const SafetyContext = z.object({
  /** Stored or residual energy of any kind (pressure, hydraulic, pneumatic, capacitive). */
  storedEnergy: z.boolean().default(false),
  /** Pressurized lines/accumulators — including a powered-off pump group (e.g. PG2). */
  pressurized: z.boolean().default(false),
  /** Hot surface above the family burn threshold. */
  hotSurface: z.boolean().default(false),
  /** Suspended load or spring tension. */
  suspendedLoad: z.boolean().default(false),
  /** Live / energized electrical exposure. */
  liveElectrical: z.boolean().default(false),
  /** Interaction with interlocks / LOTO of a safety system / guarding removal. */
  safetyInterlock: z.boolean().default(false),
  /** Moving parts (automatic guns, conveyors) not in a verified zero-energy state. */
  movingParts: z.boolean().default(false),
  /** Warranty-sensitive or PLC/control-logic-altering intervention when remote intervention requires a RED classification. */
  warrantyOrControlChange: z.boolean().default(false),
  /**
   * A genuinely low-energy, reversible observation the playbook has explicitly,
   * with human approval, marked YELLOW (e.g. read the HMI / panel face). When
   * false AND no energy flag is set, the check is novel/uncertain → default RED.
   */
  approvedLowEnergyObservation: z.boolean().default(false),
  /**
   * A purely informational, no-actuation lookup explicitly approved GREEN
   * (e.g. "what does alarm E42 mean?", "where is valve XV-204 on the drawing?").
   */
  approvedInformationalLookup: z.boolean().default(false),
});
export type SafetyContext = z.infer<typeof SafetyContext>;

/** The energy-bearing flags — any one forces RED for remote chat. */
export const ENERGY_FLAGS = [
  'storedEnergy',
  'pressurized',
  'hotSurface',
  'suspendedLoad',
  'liveElectrical',
  'safetyInterlock',
  'movingParts',
  'warrantyOrControlChange',
] as const satisfies readonly (keyof SafetyContext)[];

/** True when any energy-bearing flag is set. */
export function isEnergyBearing(ctx: SafetyContext): boolean {
  return ENERGY_FLAGS.some((flag) => ctx[flag]);
}

/**
 * Classify known energy-bearing work as RED, approved information lookups as
 * GREEN, approved low-energy observations as YELLOW, and unknown cases with the
 * conservative default.
 */
export function classifyZone(context: SafetyContext): SafetyZone {
  const ctx = SafetyContext.parse(context);

  // Energy-bearing always wins, regardless of any "approved" flag — a step cannot
  // be both energy-bearing and safely informational; the rule defaults to danger.
  if (isEnergyBearing(ctx)) return 'RED';

  if (ctx.approvedInformationalLookup) return 'GREEN';
  if (ctx.approvedLowEnergyObservation) return 'YELLOW';

  // Novel / unclassified hazard → default-to-RED.
  return DEFAULT_ZONE;
}
