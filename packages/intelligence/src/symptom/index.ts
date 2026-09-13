/**
 * Symptom layer (Layer 7) — controlled-ontology normalization.
 *
 * Public surface: the narrow `normalizeSymptom` decision policy and its types,
 * plus the no-spend `scoreSymptom` lexical ranker that feeds it candidates.
 */
export * from './normalize-symptom.js';
export * from './lexical-score.js';
