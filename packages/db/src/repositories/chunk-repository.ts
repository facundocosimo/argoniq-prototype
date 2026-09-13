import { createHash } from 'node:crypto';
import { and, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { DocumentChunkId, type TenantId } from '@argoniq/core-domain';
import { type Database } from '../client.js';
import { documentChunks } from '../schema/index.js';
import { withTenant } from '../tenant-scope.js';

/**
 * Tenant-scoped data access for document chunks. Repositories live in `@argoniq/db`
 * (the single package that talks to Postgres) so all query building uses one
 * Drizzle instance — a consumer like `services/worker` that also pulls a different
 * Postgres driver (pg, via pg-boss) never resolves a conflicting `drizzle-orm` peer.
 *
 * The interface lets a consumer depend on the contract, not Drizzle, so its logic is
 * unit-testable with an in-memory fake; the Drizzle implementation runs every read and
 * write through `withTenant` (GUC + RLS), so it re-checks isolation by construction.
 */

/**
 * The minimal chunk shape an embedding job needs — NOT the full row. `hasEmbedding` is
 * computed in SQL so the idempotency check never transfers the (large) vector itself.
 */
export type EmbeddableChunk = {
  readonly id: DocumentChunkId;
  readonly content: string;
  readonly contextualText: string | null;
  readonly hasEmbedding: boolean;
  readonly embeddingModel: string | null;
  readonly embeddingInputHash: string | null;
};

export function embeddingInputHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export interface ChunkRepository {
  find(tenantId: TenantId, chunkId: DocumentChunkId): Promise<EmbeddableChunk | null>;
  saveEmbedding(
    tenantId: TenantId,
    chunkId: DocumentChunkId,
    embedding: readonly number[],
    metadata: { readonly model: string; readonly input: string },
  ): Promise<boolean>;
  /**
   * Ids of this tenant's chunks with a missing embedding or incompatible model metadata.
   * T4 is excluded by design — restricted content must never enter the vector arm.
   * Backs the embedding backfill (seeded chunks are inserted un-embedded).
   */
  listPendingEmbedding(tenantId: TenantId, model: string): Promise<DocumentChunkId[]>;
}

export class DrizzleChunkRepository implements ChunkRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  find(tenantId: TenantId, chunkId: DocumentChunkId): Promise<EmbeddableChunk | null> {
    return withTenant(this.#db, tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: documentChunks.id,
          content: documentChunks.content,
          contextualText: documentChunks.contextualText,
          hasEmbedding: sql<boolean>`${documentChunks.embedding} is not null`,
          embeddingModel: documentChunks.embeddingModel,
          embeddingInputHash: documentChunks.embeddingInputHash,
        })
        .from(documentChunks)
        // Tenant predicate is redundant under RLS but kept as defense in depth.
        .where(and(eq(documentChunks.tenantId, tenantId), eq(documentChunks.id, chunkId)))
        .limit(1);

      const row = rows[0];
      if (!row) return null;
      return {
        id: DocumentChunkId.parse(row.id),
        content: row.content,
        contextualText: row.contextualText,
        hasEmbedding: row.hasEmbedding,
        embeddingModel: row.embeddingModel,
        embeddingInputHash: row.embeddingInputHash,
      };
    });
  }

  saveEmbedding(
    tenantId: TenantId,
    chunkId: DocumentChunkId,
    embedding: readonly number[],
    metadata: { readonly model: string; readonly input: string },
  ): Promise<boolean> {
    return withTenant(this.#db, tenantId, async (tx) => {
      const saved = await tx
        .update(documentChunks)
        .set({
          embedding: [...embedding],
          embeddingModel: metadata.model,
          embeddingInputHash: embeddingInputHash(metadata.input),
          updatedAt: new Date(),
        })
        // A slow provider response must not overwrite a newly ingested source.
        .where(
          and(
            eq(documentChunks.tenantId, tenantId),
            eq(documentChunks.id, chunkId),
            ne(documentChunks.tier, 'T4'),
            sql`coalesce(${documentChunks.contextualText}, ${documentChunks.content}) = ${metadata.input}`,
          ),
        )
        .returning({ id: documentChunks.id });
      return saved.length === 1;
    });
  }

  listPendingEmbedding(tenantId: TenantId, model: string): Promise<DocumentChunkId[]> {
    return withTenant(this.#db, tenantId, async (tx) => {
      const rows = await tx
        .select({ id: documentChunks.id })
        .from(documentChunks)
        .where(
          and(
            eq(documentChunks.tenantId, tenantId),
            or(
              isNull(documentChunks.embedding),
              isNull(documentChunks.embeddingModel),
              ne(documentChunks.embeddingModel, model),
              isNull(documentChunks.embeddingInputHash),
            ),
            ne(documentChunks.tier, 'T4'),
          ),
        );
      return rows.map((r) => DocumentChunkId.parse(r.id));
    });
  }
}
