/**
 * Ingestion layer (knowledge ingestion and transformation, Layer 5).
 *
 * The parse→chunk half of the RAG pipeline, split across a narrow parse port and a
 * pure, deterministic chunker:
 *
 *  - `ingestion-types` the parsed-block / chunk-draft vocabulary crossing the seam
 *  - `pdf-parser-port` the single parse seam + a dependency-free fixture double
 *  - `chunk-document`  structure-aware, table-atomic chunking with section provenance
 *
 * The chunker owns the hard part (keep a spec table whole, carry citable section
 * paths, build the deterministic contextual breadcrumb) and has no IO, so it is
 * unit-tested against fixtures. The concrete PDF parser (library + table/vision
 * passes) implements `PdfParserPort`; the embedding of each chunk stays in the
 * `embeddings` port, and persistence stays in `@argoniq/db`.
 */
export * from './ingestion-types.js';
export * from './pdf-parser-port.js';
export * from './chunk-document.js';
