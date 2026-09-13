import { type ParsedBlock } from '@argoniq/intelligence/ingestion';

/**
 * Pure geometry → structure reconstruction. pdf.js gives us positioned
 * text runs, not paragraphs or tables; this turns those coordinates into the typed
 * {@link ParsedBlock} stream the chunker consumes. Kept free of any pdf.js dependency so
 * it is unit-tested against synthetic item geometry (the compressed-air grid) with no
 * PDF library — the adapter (`pdfjs-parser.ts`) is the only thing that touches pdf.js.
 *
 * The heuristics are deliberately conservative and self-reporting: born-digital,
 * heading-numbered docs (this corpus) reconstruct cleanly; anything ambiguous gets a
 * low `confidence` so the confidence-gated vision pass can take over rather than the
 * pipeline trusting a shaky parse.
 */

/** A minimal positioned text run — the adapter maps pdf.js text items onto this. */
export interface TextItemLite {
  readonly str: string;
  /** Left edge x (PDF user units). */
  readonly x: number;
  /** Baseline y (PDF user units; larger = higher on the page). */
  readonly y: number;
  readonly width: number;
  /** Glyph/font height. */
  readonly height: number;
}

export interface ReconstructOptions {
  readonly page: number;
  /** Min horizontal gap (user units) between runs that signals a column boundary. */
  readonly columnGap?: number;
}

const DEFAULT_COLUMN_GAP = 22;
const HEADING_RE = /^(\d+(?:\.\d+)*)[.)]?\s+(\p{Lu}.*)$/u;

interface Line {
  readonly y: number;
  readonly height: number;
  /** Runs left→right. */
  readonly items: TextItemLite[];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Group items into visual lines (same baseline within half a line height). */
function assembleLines(items: readonly TextItemLite[]): Line[] {
  const usable = items.filter((it) => it.str.trim().length > 0);
  if (usable.length === 0) return [];
  const medHeight = median(usable.map((it) => it.height)) || 10;
  const tol = medHeight * 0.6;

  const sorted = [...usable].sort((a, b) => (Math.abs(a.y - b.y) > tol ? b.y - a.y : a.x - b.x));
  const lines: Line[] = [];
  let current: TextItemLite[] = [];
  let currentY: number | null = null;

  for (const it of sorted) {
    if (currentY === null || Math.abs(it.y - currentY) <= tol) {
      current.push(it);
      currentY = currentY === null ? it.y : (currentY + it.y) / 2;
    } else {
      lines.push(finishLine(current));
      current = [it];
      currentY = it.y;
    }
  }
  if (current.length > 0) lines.push(finishLine(current));
  return lines;
}

function finishLine(items: TextItemLite[]): Line {
  const ordered = [...items].sort((a, b) => a.x - b.x);
  return {
    y: ordered[0]!.y,
    height: median(ordered.map((it) => it.height)) || ordered[0]!.height,
    items: ordered,
  };
}

/** The x-positions where a line breaks into columns (gap > columnGap between runs). */
function columnStarts(line: Line, columnGap: number): number[] {
  const starts: number[] = [];
  let prevRight: number | null = null;
  for (const it of line.items) {
    if (prevRight === null || it.x - prevRight > columnGap) starts.push(it.x);
    prevRight = Math.max(prevRight ?? it.x + it.width, it.x + it.width);
  }
  return starts;
}

function lineText(line: Line): string {
  return line.items
    .map((it) => it.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Render a run of multi-column lines as a GitHub-flavored markdown table. */
function toMarkdownTable(rows: Line[], columnGap: number): string {
  // Union of all column start positions across the run, clustered into columns.
  const allStarts = rows.flatMap((r) => columnStarts(r, columnGap)).sort((a, b) => a - b);
  const cols: number[] = [];
  for (const s of allStarts) {
    if (cols.length === 0 || s - cols[cols.length - 1]! > columnGap) cols.push(s);
  }
  const colOf = (x: number): number => {
    let best = 0;
    for (let i = 1; i < cols.length; i += 1) {
      if (Math.abs(x - cols[i]!) < Math.abs(x - cols[best]!)) best = i;
    }
    return best;
  };

  const rawRows = rows.map((r) => {
    const cells = Array.from({ length: cols.length }, () => '');
    // Group this row's runs into their nearest column, joining runs that share one.
    for (const it of r.items) {
      const c = colOf(it.x);
      cells[c] = (cells[c] ? `${cells[c]} ${it.str}` : it.str).replace(/\s+/g, ' ').trim();
    }
    return cells;
  });

  // Drop columns that are empty in every row — an artifact of over-eager clustering.
  const keep = cols.map((_, c) => c).filter((c) => rawRows.some((cells) => cells[c]!.length > 0));
  const gridRows = rawRows.map((cells) => keep.map((c) => cells[c]!));

  const fmt = (cells: string[]): string => `| ${cells.join(' | ')} |`;
  const header = fmt(gridRows[0]!);
  const sep = `| ${keep.map(() => '---').join(' | ')} |`;
  const body = gridRows.slice(1).map(fmt);
  return [header, sep, ...body].join('\n');
}

function headingMatch(text: string): { sectionNumber: string; level: number } | null {
  const m = HEADING_RE.exec(text);
  if (!m) return null;
  // Guard against body lines like "4 per hour minimum": headings are short + title-like.
  if (text.length > 90 || text.split(/\s+/).length > 12) return null;
  return { sectionNumber: m[1]!, level: m[1]!.split('.').length };
}

/**
 * Reconstruct one page's positioned runs into ordered heading/paragraph/table blocks.
 * A maximal run of ≥2 consecutive multi-column lines becomes a table; a numbered,
 * title-like short line becomes a heading; everything else packs into paragraphs split
 * by heading boundaries. Callers concatenate pages in order.
 */
export function reconstructBlocks(
  items: readonly TextItemLite[],
  options: ReconstructOptions,
): ParsedBlock[] {
  const columnGap = options.columnGap ?? DEFAULT_COLUMN_GAP;
  const lines = assembleLines(items);
  const multi = lines.map((l) => columnStarts(l, columnGap).length >= 2);

  const blocks: ParsedBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = (): void => {
    const text = paragraph.join(' ').replace(/\s+/g, ' ').trim();
    if (text.length > 0) blocks.push({ kind: 'paragraph', text, page: options.page });
    paragraph = [];
  };

  for (let i = 0; i < lines.length;) {
    // A table is a run of ≥2 consecutive multi-column lines.
    if (multi[i]) {
      let j = i;
      while (j < lines.length && multi[j]) j += 1;
      if (j - i >= 2) {
        flushParagraph();
        blocks.push({
          kind: 'table',
          text: toMarkdownTable(lines.slice(i, j), columnGap),
          page: options.page,
          // Geometry-reconstructed tables are inherently lower-confidence than prose;
          // flag them so the gated vision read can verify merged/edge-case cells.
          confidence: 0.55,
        });
        i = j;
        continue;
      }
    }
    // Non-table line: heading or paragraph.
    const text = lineText(lines[i]!);
    const heading = headingMatch(text);
    if (heading) {
      flushParagraph();
      blocks.push({
        kind: 'heading',
        text: text.replace(HEADING_RE, '$2').trim(),
        page: options.page,
        sectionNumber: heading.sectionNumber,
        level: heading.level,
      });
    } else {
      paragraph.push(text);
    }
    i += 1;
  }
  flushParagraph();
  return blocks;
}
