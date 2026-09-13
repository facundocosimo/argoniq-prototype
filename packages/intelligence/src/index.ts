/**
 * Reasoning, safety, governance, and ingestion utilities.
 *
 * Services compose these modules through `packages/core`. The package does not
 * import UI code or read environment variables, and model access goes through
 * the `llm` port.
 *
 *  - symptom/     normalize raw wording onto the controlled ontology (Layer 7)
 *  - diagnosis/   rank causes and apply escalation policy
 *  - questioning/ max-information-gain, safety-filtered question selection (Layer 8)
 *  - safety/      deterministic GREEN/YELLOW/RED zoning + re-escalation (Layer 16)
 *  - governance/  channel exclusion, grounding checks, output provenance
 *  - llm/         the model-tiered port + Anthropic adapter + test fake
 *  - embeddings/  the embedding port + AI SDK adapter + deterministic test fake
 *  - ingestion/   the parse→chunk half of RAG: parser port + structure-aware chunker (Layer 5)
 *  - pipeline/    answer orchestration
 */
export * from './symptom/index.js';
export * from './ingestion/index.js';
export * from './diagnosis/index.js';
export * from './questioning/index.js';
export * from './safety/index.js';
export * from './governance/index.js';
export * from './llm/index.js';
export * from './embeddings/index.js';
export * from './pipeline/index.js';

export * from './conversation/intake.js';
