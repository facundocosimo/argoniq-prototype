/**
 * Safety layer (Layer 16).
 *
 * `classifyZone` is the deterministic rule (energy-bearing ⇒ RED, default RED);
 * `reconcileSuggestedZone` lets the LLM only ever raise the zone;
 * `reEscalateOnEvidence` monotonically re-escalates on hazard cues (Stage 7).
 */
export * from './classify-zone.js';
export * from './re-escalate.js';
