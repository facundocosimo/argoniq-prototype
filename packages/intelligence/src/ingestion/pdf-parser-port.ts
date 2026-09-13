import { type ParsedDocument } from './ingestion-types.js';

/**
 * The parse seam. One narrow port turns raw document bytes into a
 * {@link ParsedDocument}, exactly as {@link EmbeddingsPort} is the single seam to the
 * embedding model. The concrete implementation (a layout-aware PDF library + optional
 * table/vision passes) lives behind this interface so the chunker and the ingestion
 * orchestration are unit-testable with {@link FixtureParser} — no native PDF deps in
 * tests, no library lock-in in the domain. Everything crossing this trust edge is the
 * parser's responsibility to normalize (page numbers 1-based, tables as markdown).
 */
export interface PdfParserPort {
  /**
   * Parse a document's bytes into ordered typed blocks + detected revision metadata.
   * `filename` is a hint only (language/format guess); never trusted for tiering.
   */
  parse(bytes: Uint8Array, filename: string): Promise<ParsedDocument>;
}

/**
 * A deterministic, dependency-free parser double for tests and seed fixtures: it
 * simply returns the {@link ParsedDocument} it was constructed with, ignoring the
 * bytes. Lets the chunker and worker be exercised end to end without a PDF library.
 */
export class FixtureParser implements PdfParserPort {
  constructor(private readonly fixture: ParsedDocument) {}

  parse(_bytes: Uint8Array, _filename: string): Promise<ParsedDocument> {
    return Promise.resolve(this.fixture);
  }
}
