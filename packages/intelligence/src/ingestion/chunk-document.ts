import { type ChunkDraft, type ParsedBlock, type ParsedDocument } from './ingestion-types.js';

/**
 * Structure-aware chunking (the `retrieval-architecture` memory).
 * The rules, in priority order:
 *
 *  1. **Chunk on the document's own section hierarchy**, not a fixed window. A new
 *     heading always starts a new chunk, and every chunk carries its `sectionPath`
 *     ("6.4") + `sectionTitle` — the semantic provenance unit cited alongside the page.
 *  2. **Tables are atomic.** A `table` block becomes its own chunk and is never merged
 *     with the surrounding prose or split across its header/row boundary — this is what
 *     keeps "Supply Pressure | 6–10 bar" answerable instead of shredding the column
 *     association. A table that spans pages keeps its full `page…pageEnd` span.
 *  3. **Figures become retrieval proxies.** A `figure` block (a vision caption for an
 *     image-only page) is its own `figure` chunk pointing at that page.
 *  4. **Prose is packed to a budget within a section**, split only when it exceeds
 *     `maxChars` — never across a section boundary.
 *
 * The default `contextualText` is a deterministic breadcrumb (doc title + section path +
 * content); the confidence-gated LLM contextualization pass (which needs the LlmPort)
 * only upgrades chunks flagged `needsEnrichment`. Pure and deterministic — no IO.
 */

export interface ChunkDocumentOptions {
  /** The document title, used to build the deterministic breadcrumb prefix. */
  readonly docTitle: string;
  /** Soft cap on prose chunk size in characters (~4 chars/token). Default ≈ 600 tokens. */
  readonly maxChars?: number;
  /** Parser confidence at/below which a chunk is flagged for vision/LLM enrichment. */
  readonly enrichBelowConfidence?: number;
}

const DEFAULT_MAX_CHARS = 2400;
const DEFAULT_ENRICH_BELOW = 0.6;

interface SectionContext {
  readonly path: string | null;
  readonly title: string | null;
}

/** The deterministic contextual prefix embedded ahead of the chunk body. */
function breadcrumb(docTitle: string, section: SectionContext, body: string): string {
  const head = section.path
    ? `${docTitle} — section ${section.path} ${section.title ?? ''}`.trim()
    : docTitle;
  return `${head}\n\n${body}`;
}

function isLowConfidence(block: ParsedBlock, threshold: number): boolean {
  return block.confidence !== undefined && block.confidence <= threshold;
}

/** Turn a parsed document into ordered, section-aware, table-atomic chunk drafts. */
export function chunkDocument(doc: ParsedDocument, options: ChunkDocumentOptions): ChunkDraft[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const enrichBelow = options.enrichBelowConfidence ?? DEFAULT_ENRICH_BELOW;

  const chunks: ChunkDraft[] = [];
  let section: SectionContext = { path: null, title: null };

  // Pending prose accumulator (packed within the current section, up to maxChars).
  let proseParts: string[] = [];
  let proseStartPage: number | null = null;
  let proseEndPage: number | null = null;
  let proseLowConfidence = false;

  const flushProse = (): void => {
    if (proseParts.length === 0) return;
    const content = proseParts.join('\n\n').trim();
    if (content.length > 0) {
      chunks.push({
        chunkIndex: chunks.length,
        chunkType: 'prose',
        page: proseStartPage,
        pageEnd: proseEndPage !== proseStartPage ? proseEndPage : null,
        sectionPath: section.path,
        sectionTitle: section.title,
        content,
        contextualText: breadcrumb(options.docTitle, section, content),
        needsEnrichment: proseLowConfidence,
      });
    }
    proseParts = [];
    proseStartPage = null;
    proseEndPage = null;
    proseLowConfidence = false;
  };

  const emitAtomic = (block: ParsedBlock, chunkType: ChunkDraft['chunkType']): void => {
    const content = block.text.trim();
    if (content.length === 0) return;
    chunks.push({
      chunkIndex: chunks.length,
      chunkType,
      page: block.page,
      pageEnd: block.pageEnd && block.pageEnd !== block.page ? block.pageEnd : null,
      sectionPath: section.path,
      sectionTitle: section.title,
      content,
      contextualText: breadcrumb(options.docTitle, section, content),
      needsEnrichment: isLowConfidence(block, enrichBelow),
    });
  };

  for (const block of doc.blocks) {
    switch (block.kind) {
      case 'heading': {
        // A heading closes the running prose and redefines the section context.
        flushProse();
        section = {
          path: block.sectionNumber ?? section.path,
          title: block.text.trim() || section.title,
        };
        break;
      }
      case 'table': {
        // Atomic: never merged with prose, never split across header/rows.
        flushProse();
        emitAtomic(block, 'table');
        break;
      }
      case 'figure': {
        flushProse();
        emitAtomic(block, 'figure');
        break;
      }
      case 'caption': {
        flushProse();
        emitAtomic(block, 'caption');
        break;
      }
      case 'paragraph':
      case 'list': {
        const text = block.text.trim();
        if (text.length === 0) break;
        const projected = [...proseParts, text].join('\n\n');
        // Split within the section when the budget is exceeded and retain its path.
        if (proseParts.length > 0 && projected.length > maxChars) {
          flushProse();
        }
        proseParts.push(text);
        proseStartPage ??= block.page;
        proseEndPage = block.pageEnd ?? block.page;
        proseLowConfidence ||= isLowConfidence(block, enrichBelow);
        break;
      }
      /* c8 ignore next 2 -- exhaustiveness guard */
      default:
        break;
    }
  }
  flushProse();

  return chunks;
}
