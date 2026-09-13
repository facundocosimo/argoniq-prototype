import { z } from 'zod';

/**
 * Document category — WHAT KIND of artifact a document is, independent of its tier
 * (audience), applicability (which machines), provenance (how it arrived), and format.
 * A small, controlled vocabulary (cf. S1000D information codes / PLM document types):
 * curated and extensible, never free-text and never one-per-artifact.
 *
 * Categories are orthogonal to tiers: a `schematic` may be T1 or T3; a `certificate`
 * is usually T1. Retrieval and the coverage matrix filter on this axis.
 *
 * Some categories are NOT retrieval documents — `backup` (PLC/firmware images) and
 * `cad` (native CAD source) are binary artifacts the AI cannot read. They still live in
 * the library (catalogued, versioned, tier-governed, downloadable) but are marked
 * non-indexable (see {@link defaultIndexable}) so they are never chunked or embedded.
 * Structured data (a bill of materials, parameter sets) is intentionally NOT a document
 * category — it belongs in first-class structured records, not the RAG corpus.
 */
export const DOCUMENT_CATEGORIES = [
  'operation',
  'service',
  'installation',
  'safety',
  'schematic',
  'drawing',
  'parts',
  'certificate',
  'datasheet',
  'bulletin',
  'parameters',
  'backup',
  'cad',
  'other',
] as const;

export const DocumentCategory = z.enum(DOCUMENT_CATEGORIES);
export type DocumentCategory = z.infer<typeof DocumentCategory>;

/** Human labels for the UI (catalog, coverage columns, upload picker). */
export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  operation: 'Operation manual',
  service: 'Service procedure',
  installation: 'Installation & facility',
  safety: 'Safety',
  schematic: 'Schematic / diagram',
  drawing: 'Drawing',
  parts: 'Parts catalog',
  certificate: 'Certificate',
  datasheet: 'Datasheet',
  bulletin: 'Service bulletin',
  parameters: 'Parameters',
  backup: 'Software / PLC backup',
  cad: 'CAD source',
  other: 'Other',
};

/** Categories whose artifacts are binary/non-textual — never fed to retrieval. */
const NON_INDEXABLE_CATEGORIES = new Set<DocumentCategory>(['backup', 'cad']);

/**
 * Whether a document of this category should be indexed for AI retrieval BY DEFAULT.
 * Binary artifacts (PLC backups, CAD source) default to false; the uploader may still
 * override per document (the stored `indexable` flag is the source of truth).
 */
export function defaultIndexable(category: DocumentCategory): boolean {
  return !NON_INDEXABLE_CATEGORIES.has(category);
}

export function documentCategoryLabel(category: string): string {
  return DOCUMENT_CATEGORY_LABELS[category as DocumentCategory] ?? 'Other';
}
