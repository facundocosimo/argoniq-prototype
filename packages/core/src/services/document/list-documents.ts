import { z } from 'zod';
import { effectiveDocument, readableDocument } from './eligibility.js';
import { and, desc, eq, getTableColumns, inArray, or, sql, type SQL } from 'drizzle-orm';
import { MachineFamilyId, SerialId } from '@argoniq/core-domain';
import { CursorPaginationInput, type Page } from '@argoniq/contracts';
import { type DocumentRow, documentChunks, documents } from '@argoniq/db';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { decodeCursor, toPage } from '../../pagination.js';
import {
  type ChunkStats,
  type DocumentHealth,
  EMPTY_CHUNK_STATS,
  computeDocumentHealth,
} from './document-health.js';

export const ListDocumentsInput = CursorPaginationInput.extend({
  familyId: MachineFamilyId.optional(),
  serialId: SerialId.optional(),
  search: z.string().max(200).optional(),
});
export type ListDocumentsInput = z.infer<typeof ListDocumentsInput>;

/** A listed document enriched with derived ingestion health (chunk counts + issues). */
export type DocumentListItem = DocumentRow & { readonly health: DocumentHealth };

/**
 * List documents the actor may see. Tier visibility is applied as a SQL filter
 * (never fetch-then-drop), so T3/T4 never even leave the database for a customer
 * and T2 is scoped to the customer's own rows ( gate 2 at the data layer).
 */
export async function listDocuments(
  ctx: ServiceContext,
  input: unknown,
): Promise<Page<DocumentListItem>> {
  const { cursor, limit, familyId, serialId, search } = parseInput(ListDocumentsInput, input);
  ctx.policy.assertCan('read', 'Document');

  const keyset = cursor ? decodeCursor(cursor) : null;
  // JS cursors have millisecond precision; use the same precision for SQL ordering
  // and comparisons so bulk inserts with PostgreSQL microseconds cannot disappear.
  const sortCreatedAt = sql`date_trunc('milliseconds', ${documents.createdAt})`;

  const rows = await ctx.withTenant(async (tx) => {
    const conditions: SQL[] = [readableDocument(ctx, serialId ? { serialId } : {})];
    if (search) conditions.push(sql`strpos(lower(${documents.title}), lower(${search})) > 0`);
    if (familyId) conditions.push(eq(documents.familyId, familyId));
    if (keyset) {
      conditions.push(
        or(
          sql`${sortCreatedAt} < ${keyset.createdAt.toISOString()}::timestamptz`,
          and(
            sql`${sortCreatedAt} = ${keyset.createdAt.toISOString()}::timestamptz`,
            sql`${documents.id} < ${keyset.id}::uuid`,
          ),
        )!,
      );
    }
    const docRows = await tx
      .select({ ...getTableColumns(documents), isCurrent: sql<boolean>`${effectiveDocument()}` })
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(sortCreatedAt), desc(documents.id))
      .limit(limit + 1);

    // Derived ingestion health: one grouped pass over the listed documents' chunks.
    const statsByDoc = await loadChunkStats(
      tx,
      docRows.map((r) => r.id),
    );
    return docRows.map((r) => ({
      ...r,
      health: computeDocumentHealth(
        r.status,
        statsByDoc.get(r.id) ?? EMPTY_CHUNK_STATS,
        r.indexable,
      ),
    }));
  });

  return toPage(rows, limit, (row) => ({ createdAt: row.createdAt, id: row.id }));
}

/**
 * Chunk tallies per document in one grouped query (never N+1). Runs inside the caller's
 * tenant transaction (RLS-scoped). `filter (where …)` gives the embeddable (non-T4) and
 * per-type counts alongside the totals.
 */
export async function loadChunkStats(
  tx: Parameters<Parameters<ServiceContext['withTenant']>[0]>[0],
  documentIds: readonly string[],
): Promise<Map<string, ChunkStats>> {
  if (documentIds.length === 0) return new Map();
  const rows = await tx
    .select({
      documentId: documentChunks.documentId,
      chunkCount: sql<number>`count(*)::int`,
      embeddedChunkCount: sql<number>`count(${documentChunks.embedding})::int`,
      embeddableChunkCount: sql<number>`(count(*) filter (where ${documentChunks.tier} <> 'T4'))::int`,
      tableChunkCount: sql<number>`(count(*) filter (where ${documentChunks.chunkType} = 'table'))::int`,
      figureChunkCount: sql<number>`(count(*) filter (where ${documentChunks.chunkType} = 'figure'))::int`,
    })
    .from(documentChunks)
    .where(inArray(documentChunks.documentId, [...documentIds]))
    .groupBy(documentChunks.documentId);
  return new Map(
    rows.map((r) => [
      r.documentId,
      {
        chunkCount: r.chunkCount,
        embeddedChunkCount: r.embeddedChunkCount,
        embeddableChunkCount: r.embeddableChunkCount,
        tableChunkCount: r.tableChunkCount,
        figureChunkCount: r.figureChunkCount,
      },
    ]),
  );
}
