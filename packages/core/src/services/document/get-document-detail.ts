import { effectiveDocument, readableDocument } from './eligibility.js';
import { and, asc, desc, eq, getTableColumns, min, sql } from 'drizzle-orm';
import { z } from 'zod';
import { DocumentId } from '@argoniq/core-domain';
import { type DocumentRow, documentChunks, documents } from '@argoniq/db';
import { NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import {
  type DocumentHealth,
  EMPTY_CHUNK_STATS,
  computeDocumentHealth,
} from './document-health.js';
import { loadChunkStats } from './list-documents.js';

export const GetDocumentInput = z.object({ documentId: DocumentId });
export type GetDocumentInput = z.infer<typeof GetDocumentInput>;

/** One revision in a logical document's history. */
export interface DocumentRevisionSummary {
  readonly id: string;
  readonly revisionLabel: string | null;
  readonly revisionNumber: number;
  readonly isCurrent: boolean;
  readonly effectiveFrom: Date | null;
  readonly status: string;
  readonly pageCount: number | null;
}

/** A section in the document's own numbering, with its first page for citation links. */
export interface DocumentOutlineEntry {
  readonly sectionPath: string;
  readonly sectionTitle: string | null;
  readonly page: number | null;
}

export interface DocumentDetail {
  readonly document: DocumentRow;
  /** Every revision in the explicit lineage, newest first. */
  readonly revisions: DocumentRevisionSummary[];
  readonly outline: DocumentOutlineEntry[];
  /** Derived ingestion health for the current document (chunk counts + issues). */
  readonly health: DocumentHealth;
}

/**
 * Load one document with its revision history and section outline. Tier visibility is
 * enforced (a tier the actor can't see resolves to a clean 404, never a leak), and for
 * a customer a T2 document must be their own. The revision chain is grouped by `docKey`
 * (or the id when a document has no part-number identity). The outline is the document's
 * own numbered sections, matching the handles used by answer citations.
 */
export async function getDocumentDetail(
  ctx: ServiceContext,
  input: unknown,
): Promise<DocumentDetail> {
  const { documentId } = parseInput(GetDocumentInput, input);
  ctx.policy.assertCan('read', 'Document');

  return ctx.withTenant(async (tx) => {
    const [document] = await tx
      .select({ ...getTableColumns(documents), isCurrent: sql<boolean>`${effectiveDocument()}` })
      .from(documents)
      .where(and(eq(documents.id, documentId), readableDocument(ctx, { historical: true })))
      .limit(1);
    if (!document) throw new NotFoundError('document', documentId);
    // Revision chain: explicit lineage, with the same read policy for every entry.
    const revisionRows = document.revisionGroupId
      ? await tx
          .select({
            id: documents.id,
            revisionLabel: documents.revisionLabel,
            revisionNumber: documents.revisionNumber,
            isCurrent: sql<boolean>`${effectiveDocument()}`,
            effectiveFrom: documents.effectiveFrom,
            status: documents.status,
            pageCount: documents.pageCount,
          })
          .from(documents)
          .where(
            and(
              eq(documents.tenantId, ctx.tenantId),
              eq(documents.revisionGroupId, document.revisionGroupId),
              readableDocument(ctx, { historical: true }),
            ),
          )
          .orderBy(desc(documents.revisionNumber))
      : [
          {
            id: document.id,
            revisionLabel: document.revisionLabel,
            revisionNumber: document.revisionNumber,
            isCurrent: document.isCurrent,
            effectiveFrom: document.effectiveFrom,
            status: document.status,
            pageCount: document.pageCount,
          },
        ];

    const outlineRows = await tx
      .select({
        sectionPath: documentChunks.sectionPath,
        sectionTitle: documentChunks.sectionTitle,
        page: min(documentChunks.page),
      })
      .from(documentChunks)
      .where(
        and(
          eq(documentChunks.documentId, documentId),
          sql`${documentChunks.sectionPath} is not null`,
        ),
      )
      .groupBy(documentChunks.sectionPath, documentChunks.sectionTitle)
      // Page first (the jump target), then section path for deterministic within-page order.
      .orderBy(asc(min(documentChunks.page)), asc(documentChunks.sectionPath))
      .limit(300);

    const stats = (await loadChunkStats(tx, [documentId])).get(documentId) ?? EMPTY_CHUNK_STATS;

    return {
      document,
      revisions: revisionRows,
      outline: outlineRows.map((r) => ({
        sectionPath: r.sectionPath ?? '',
        sectionTitle: r.sectionTitle,
        page: r.page,
      })),
      health: computeDocumentHealth(document.status, stats, document.indexable),
    };
  });
}

/**
 * Resolve a document's storage key IF the actor may read it — the authorization gate
 * for the `/api/storage` download route. Returns null (resulting in 404) when the document is
 * missing or the actor can't see its tier, so the route never streams bytes the actor
 * couldn't have listed.
 */
export async function resolveReadableStorageKey(
  ctx: ServiceContext,
  documentId: string,
): Promise<{ storageKey: string; mimeType: string | null; filename: string | null } | null> {
  const parsed = DocumentId.safeParse(documentId);
  if (!parsed.success) return null;
  ctx.policy.assertCan('read', 'Document');
  return ctx.withTenant(async (tx) => {
    const [document] = await tx
      .select({
        tier: documents.tier,
        storageKey: documents.storageKey,
        mimeType: documents.mimeType,
        filename: documents.originalFilename,
        companyId: documents.companyId,
      })
      .from(documents)
      .where(and(eq(documents.id, parsed.data), readableDocument(ctx, { historical: true })))
      .limit(1);
    if (!document) return null;
    return {
      storageKey: document.storageKey,
      mimeType: document.mimeType,
      filename: document.filename,
    };
  });
}
