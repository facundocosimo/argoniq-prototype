/**
 * Ingestion jobs. Each job is a pure handler over injected ports
 * (persistence from `@argoniq/db`, the model from `@argoniq/intelligence`),
 * so its contract is unit-tested without infrastructure. The pg-boss wiring that runs
 * them lives in `../queue.ts`.
 */
export * from './embed-chunk.js';
export * from './ingest-document.js';
