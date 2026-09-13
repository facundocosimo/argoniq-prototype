import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  type DetectedRevision,
  type ParsedBlock,
  type ParsedDocument,
  type PdfParserPort,
} from '@argoniq/intelligence/ingestion';
import { type TextItemLite, reconstructBlocks } from './reconstruct-layout.js';

/**
 * The concrete {@link PdfParserPort} over pdf.js (born-digital text layer) + @napi-rs/canvas
 * (gated page-image render). pdf.js gives positioned text runs per page; the pure
 * {@link reconstructBlocks} turns those into heading/paragraph/table blocks, and this
 * adapter stitches pages in order, lifts revision metadata from the front matter, and
 * — only when asked — rasterizes a page for the confidence-gated vision read. All
 * pdf.js contact is confined here so the domain (chunker) stays library-free.
 *
 * pdf.js in Node runs on a fake (main-thread) worker; we disable external font/worker
 * fetches to keep the parse hermetic and the supply-chain surface minimal.
 */
export class PdfjsParser implements PdfParserPort {
  async parse(bytes: Uint8Array, filename: string): Promise<ParsedDocument> {
    const loadingTask = pdfjs.getDocument({
      // pdf.js may detach the buffer; hand it a private copy.
      data: new Uint8Array(bytes),
      useSystemFonts: false,
      useWorkerFetch: false,
      disableFontFace: true,
    });
    const doc = await loadingTask.promise;

    try {
      if (doc.numPages > 1000) throw new Error('PDF exceeds the 1000-page processing limit.');
      const blocks: ParsedBlock[] = [];
      const frontMatter: string[] = [];
      for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
        const page = await doc.getPage(pageNo);
        const content = await page.getTextContent();
        const items = mapTextItems(content.items);
        if (pageNo <= 4) frontMatter.push(items.map((it) => it.str).join(' '));
        blocks.push(...reconstructBlocks(items, { page: pageNo }));
        page.cleanup();
      }
      const revision = detectRevision(frontMatter.join('\n'), filename);
      return {
        pageCount: doc.numPages,
        language: 'und',
        blocks,
        ...(revision ? { revision } : {}),
      };
    } finally {
      await loadingTask.destroy();
    }
  }

  /**
   * Rasterize one 1-based page to WebP bytes for the gated vision read. Best-effort:
   * on any render failure (missing canvas globals, exotic content) it returns null and
   * the caller falls back to the extracted markdown rather than failing ingestion.
   */
  async renderPage(bytes: Uint8Array, page: number, scale = 2): Promise<Uint8Array | null> {
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(bytes),
      useWorkerFetch: false,
    });
    const doc = await loadingTask.promise;
    try {
      const pdfPage = await doc.getPage(page);
      const viewport = pdfPage.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      // @napi-rs/canvas is structurally compatible with pdf.js's expected 2D context.
      await pdfPage.render({
        canvas: null,
        canvasContext: context,
        viewport,
      }).promise;
      return new Uint8Array(canvas.toBuffer('image/webp'));
    } catch {
      return null;
    } finally {
      await loadingTask.destroy();
    }
  }
}

/** pdf.js text items → the parser-agnostic {@link TextItemLite} the reconstructor needs. */
function mapTextItems(items: readonly unknown[]): TextItemLite[] {
  const out: TextItemLite[] = [];
  for (const raw of items) {
    const it = raw as { str?: string; transform?: number[]; width?: number; height?: number };
    if (typeof it.str !== 'string' || !it.transform) continue;
    const [, b, , d, e, f] = it.transform;
    out.push({
      str: it.str,
      x: e ?? 0,
      y: f ?? 0,
      width: it.width ?? 0,
      // Font height from the transform scale (|d| or the row vector magnitude).
      height: it.height ?? Math.hypot(b ?? 0, d ?? 0) ?? 10,
    });
  }
  return out;
}

const PART_NUMBER_RE = /p\/n[:\s]+([0-9]{2,}-[A-Z]?[0-9]+)/i;
const REVISION_RE = /\brev(?:ision)?[.:\s]+([A-Z]|[0-9]+(?:\.[0-9]+)?)\b/i;
const DATE_RE =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i;

/** Lift docKey (part number), revision label, and effective date from the front matter. */
function detectRevision(text: string, filename: string): DetectedRevision | undefined {
  const part = PART_NUMBER_RE.exec(text) ?? PART_NUMBER_RE.exec(filename);
  const rev = REVISION_RE.exec(text);
  const date = DATE_RE.exec(text);
  const revision: { docKey?: string; label?: string; effectiveFrom?: string } = {};
  if (part) revision.docKey = part[1]!.toUpperCase();
  if (rev) revision.label = rev[1]!.toUpperCase();
  if (date) {
    const month = new Date(`${date[1]} 1, ${date[2]} UTC`).getUTCMonth();
    revision.effectiveFrom = new Date(Date.UTC(Number(date[2]), month, 1)).toISOString();
  }
  return Object.keys(revision).length > 0 ? revision : undefined;
}
