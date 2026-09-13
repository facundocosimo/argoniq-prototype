/**
 * Ingestion data types. The layout-aware parser turns raw
 * document bytes into an ordered stream of typed {@link ParsedBlock}s — the seam
 * between "how a PDF was parsed" (library/vision detail, behind {@link PdfParserPort})
 * and "how it becomes retrievable chunks" (the pure {@link chunkDocument} IP). Keeping
 * these separate means the chunker — the part that must keep a spec table atomic and
 * carry section-path provenance, is unit-testable against a fixture with no PDF library.
 */

/** The kind of a parsed block, in document reading order. */
export const PARSED_BLOCK_KINDS = [
  'heading',
  'paragraph',
  'list',
  'table',
  'figure',
  'caption',
] as const;
export type ParsedBlockKind = (typeof PARSED_BLOCK_KINDS)[number];

/**
 * One logical block a layout parser emits. A `table` block's `text` is the table
 * rendered as GitHub-flavored markdown (columns preserved — the compressed-air /
 * torque-spec case); a `figure` block's `text` is a vision-generated caption that
 * acts as the retrieval proxy for an image-only page ( step 4).
 */
export interface ParsedBlock {
  readonly kind: ParsedBlockKind;
  readonly text: string;
  /** 1-based page the block starts on. */
  readonly page: number;
  /** Last page when the block spans a boundary (a table continuing across pages). */
  readonly pageEnd?: number;
  /** For `heading` blocks: the document's own section number, e.g. "6.4". */
  readonly sectionNumber?: string;
  /** For `heading` blocks: nesting depth (1 = top-level section). */
  readonly level?: number;
  /**
   * Parser confidence for this block (0–1). Drives the confidence-gated stages:
   * a low-confidence table triggers the page-image vision read; a low-confidence
   * chunk is a candidate for LLM contextualization instead of a bare breadcrumb.
   */
  readonly confidence?: number;
}

/** Revision metadata the parser lifts from the document's own front matter / title block. */
export interface DetectedRevision {
  /** Publisher document key → logical-document identity (e.g. "ATLAS-REF-01"). */
  readonly docKey?: string;
  /** Revision stamp as printed ("C", "Rev C", "2.1"). */
  readonly label?: string;
  /** Revision date as an ISO string, if stated in the revision history. */
  readonly effectiveFrom?: string;
}

/** The parser's output — the input to {@link chunkDocument}. */
export interface ParsedDocument {
  readonly pageCount: number;
  /** BCP-47-ish language detected for the source ( multilingual reality). */
  readonly language: string;
  readonly blocks: readonly ParsedBlock[];
  readonly revision?: DetectedRevision;
}

/**
 * A chunk ready for persistence, mirroring the `document_chunks` columns the chunker
 * owns (the repository fills tenant/document/tier/embedding). `contextualText` is what
 * gets embedded — a deterministic breadcrumb by default (section path + doc title), so a
 * bare spec-table row is still retrievable without an LLM contextualization pass.
 */
export interface ChunkDraft {
  readonly chunkIndex: number;
  readonly chunkType: 'prose' | 'table' | 'figure' | 'caption';
  readonly page: number | null;
  readonly pageEnd: number | null;
  readonly sectionPath: string | null;
  readonly sectionTitle: string | null;
  readonly content: string;
  readonly contextualText: string;
  /** True when the parser confidence was low enough to warrant a vision/LLM upgrade. */
  readonly needsEnrichment: boolean;
}
