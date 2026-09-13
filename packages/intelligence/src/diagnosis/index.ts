/**
 * Cause ranking and escalation decisions for diagnostic requests.
 *
 * `rankCauses` turns priors + evidence into capped, floored posteriors;
 * `decideEscalation` applies the one conservative  gate to those posteriors.
 */
export * from './rank-causes.js';
export * from './decide-escalation.js';
