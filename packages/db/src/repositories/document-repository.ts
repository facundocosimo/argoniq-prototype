import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import {
  DocumentChunkId,
  type DocumentCategory,
  DocumentId,
  DocumentScope,
  type KnowledgeTier,
  TenantId,
} from '@argoniq/core-domain';
import { ValidationError } from '@argoniq/observability';
import { type Database } from '../client.js';
import {
  companies,
  documentChunks,
  documents,
  installations,
  machineFamilies,
  machineModels,
  serials,
  tenants,
} from '../schema/index.js';
import { type TenantTransaction, withTenant } from '../tenant-scope.js';

/**
 * Tenant-scoped writes for the ingestion pipeline. Like {@link ChunkRepository}, this
 * lives in `@argoniq/db` (the single Postgres package) so `services/worker`
 * — which also pulls `pg` via pg-boss — never resolves a conflicting `drizzle-orm`
 * peer. The worker depends on this interface and builds no SQL itself. Every statement
 * runs through `withTenant` (GUC + RLS), so isolation is re-checked by construction.
 */

/** The document fields the ingest job needs to fetch and parse its source. */
export interface IngestableDocument {
  readonly id: DocumentId;
  readonly tier: KnowledgeTier;
  readonly title: string;
  readonly storageKey: string;
}

/** One chunk to persist — the chunker's draft, plus the denormalized tier. */
export interface ChunkInsert {
  readonly chunkIndex: number;
  readonly chunkType: 'prose' | 'table' | 'figure' | 'caption';
  readonly page: number | null;
  readonly pageEnd: number | null;
  readonly sectionPath: string | null;
  readonly sectionTitle: string | null;
  readonly content: string;
  readonly contextualText: string;
  readonly aiMayCite: boolean;
  readonly forbiddenForCustomerFacing: boolean;
}

/** Revision/metadata the parser lifted from the source, applied without clobbering user input. */
export interface IngestionMetadata {
  readonly pageCount: number;
  readonly docKey?: string;
  readonly revisionLabel?: string;
  readonly effectiveFrom?: Date;
}

export type DocumentStatus = 'uploaded' | 'processing' | 'ingested' | 'failed';

/** The scope + metadata an uploader declares when creating a document revision. */
export interface CreateDocumentInput {
  /** Pre-generated id, so the caller can derive the storage key before insert. */
  readonly id?: string;
  readonly tier: KnowledgeTier;
  readonly sourceType:
    'manual_pdf' | 'structured_export' | 'case_history' | 'field_photo' | 'service_bulletin';
  readonly category?: DocumentCategory;
  /** Whether the document is eligible for AI retrieval. Defaults to true. */
  readonly indexable?: boolean;
  readonly title: string;
  readonly storageKey: string;
  readonly familyId?: string | null;
  readonly modelId?: string | null;
  readonly companyId?: string | null;
  readonly serialId?: string | null;
  readonly installationId?: string | null;
  readonly docKey?: string | null;
  readonly revisionLabel?: string | null;
  readonly originalFilename?: string | null;
  readonly mimeType?: string | null;
  readonly fileHash?: string | null;
}

export interface DocumentRepository {
  claimIngestion(
    tenantId: TenantId,
    documentId: DocumentId,
  ): Promise<(IngestableDocument & { token: string }) | null>;
  commitIngestion(
    tenantId: TenantId,
    documentId: DocumentId,
    token: string,
    chunks: readonly ChunkInsert[],
    report: { pages: number; textPages: number; reviewChunks: number },
  ): Promise<DocumentChunkId[] | null>;
  failIngestion(
    tenantId: TenantId,
    documentId: DocumentId,
    token: string,
    message: string,
  ): Promise<void>;
  /** Create a document revision row (status `uploaded`) and return its id. */
  createDocument(tenantId: TenantId, input: CreateDocumentInput): Promise<DocumentId>;
  loadForIngest(tenantId: TenantId, documentId: DocumentId): Promise<IngestableDocument | null>;
  setStatus(tenantId: TenantId, documentId: DocumentId, status: DocumentStatus): Promise<void>;
  /** Replace all chunks for a document (idempotent reprocess) and return the new ids. */
  replaceChunks(
    tenantId: TenantId,
    documentId: DocumentId,
    tier: KnowledgeTier,
    chunks: readonly ChunkInsert[],
  ): Promise<DocumentChunkId[]>;
  /** Mark ingestion complete: status=ingested, page count, and COALESCE'd revision metadata. */
  completeIngestion(
    tenantId: TenantId,
    documentId: DocumentId,
    meta: IngestionMetadata,
  ): Promise<void>;
}

/** Lock referenced rows while checking ownership so they cannot be reassigned
 * between validation and insertion. Explicit tenant predicates also protect
 * callers using a database role that bypasses RLS. This is not a substitute for
 * database invariants covering raw SQL and later updates to related records. */
export async function assertDocumentScope(
  tx: TenantTransaction,
  tenantId: TenantId,
  scope: DocumentScope,
): Promise<void> {
  if (scope.companyId) {
    const [company] = await tx
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.tenantId, tenantId), eq(companies.id, scope.companyId)))
      .limit(1)
      .for('share');
    if (!company)
      throw new ValidationError('The selected company is not available in this workspace.');
  }
  if (scope.familyId) {
    const [family] = await tx
      .select({ id: machineFamilies.id })
      .from(machineFamilies)
      .where(and(eq(machineFamilies.tenantId, tenantId), eq(machineFamilies.id, scope.familyId)))
      .limit(1)
      .for('share');
    if (!family)
      throw new ValidationError('The selected product family is not available in this workspace.');
  }
  if (scope.modelId) {
    const [model] = await tx
      .select({ familyId: machineModels.familyId })
      .from(machineModels)
      .where(and(eq(machineModels.tenantId, tenantId), eq(machineModels.id, scope.modelId)))
      .limit(1)
      .for('share');
    if (!model) throw new ValidationError('The selected model is not available in this workspace.');
    if (scope.familyId && model.familyId !== scope.familyId) {
      throw new ValidationError('The selected model belongs to a different product family.');
    }
  }
  if (scope.installationId) {
    const [installation] = await tx
      .select({ companyId: installations.companyId })
      .from(installations)
      .where(and(eq(installations.tenantId, tenantId), eq(installations.id, scope.installationId)))
      .limit(1)
      .for('share');
    if (!installation)
      throw new ValidationError('The selected installation is not available in this workspace.');
    if (installation.companyId !== scope.companyId) {
      throw new ValidationError('The selected installation belongs to a different company.');
    }
  }
  if (scope.serialId) {
    const [serial] = await tx
      .select({
        companyId: serials.companyId,
        familyId: serials.familyId,
        modelId: serials.modelId,
        installationId: serials.installationId,
      })
      .from(serials)
      .where(and(eq(serials.tenantId, tenantId), eq(serials.id, scope.serialId)))
      .limit(1)
      .for('share');
    if (!serial)
      throw new ValidationError('The selected machine is not available in this workspace.');
    if (serial.companyId !== scope.companyId) {
      throw new ValidationError('The selected machine belongs to a different company.');
    }
    if (scope.familyId && serial.familyId !== scope.familyId) {
      throw new ValidationError('The selected machine belongs to a different product family.');
    }
    if (scope.modelId && serial.modelId !== scope.modelId) {
      throw new ValidationError('The selected machine uses a different model.');
    }
    if (scope.installationId && serial.installationId !== scope.installationId) {
      throw new ValidationError('The selected machine belongs to a different installation.');
    }
  }
}

function parseDocumentScope(input: unknown): DocumentScope {
  const result = DocumentScope.safeParse(input);
  if (!result.success) throw ValidationError.fromZod(result.error);
  return result.data;
}

export class DrizzleDocumentRepository implements DocumentRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  claimIngestion(tenantId: TenantId, documentId: DocumentId) {
    return withTenant(this.#db, tenantId, async (tx) => {
      const token = randomUUID();
      const [doc] = await tx
        .update(documents)
        .set({
          status: 'processing',
          ingestionToken: token,
          processingError: null,
          updatedAt: sql`greatest(clock_timestamp(), ${documents.updatedAt} + interval '1 millisecond')`,
        })
        .where(
          and(
            eq(documents.tenantId, tenantId),
            eq(documents.id, documentId),
            eq(documents.indexable, true),
            eq(documents.publication, 'draft'),
            sql`${documents.deletedAt} is null and ${documents.publishedAt} is null`,
            sql`(${documents.status} in ('uploaded', 'failed') or (${documents.status} = 'processing' and ${documents.updatedAt} < now() - interval '15 minutes'))`,
          ),
        )
        .returning();
      return doc
        ? {
            id: DocumentId.parse(doc.id),
            tier: doc.tier,
            title: doc.title,
            storageKey: doc.storageKey,
            token,
          }
        : null;
    });
  }

  commitIngestion(
    tenantId: TenantId,
    documentId: DocumentId,
    token: string,
    chunks: readonly ChunkInsert[],
    report: { pages: number; textPages: number; reviewChunks: number },
  ) {
    return withTenant(this.#db, tenantId, async (tx) => {
      const [doc] = await tx
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.tenantId, tenantId),
            eq(documents.id, documentId),
            eq(documents.ingestionToken, token),
            eq(documents.publication, 'draft'),
          ),
        )
        .for('update');
      if (!doc || doc.deletedAt) return null;
      await tx
        .delete(documentChunks)
        .where(
          and(eq(documentChunks.tenantId, tenantId), eq(documentChunks.documentId, documentId)),
        );
      const rows = chunks.length
        ? await tx
            .insert(documentChunks)
            .values(chunks.map((c) => ({ ...c, documentId, tenantId, tier: doc.tier })))
            .returning({ id: documentChunks.id })
        : [];
      await tx
        .update(documents)
        .set({
          status: chunks.length ? 'ingested' : 'failed',
          pageCount: report.pages,
          extractionReport: report,
          processingError: chunks.length
            ? null
            : 'No selectable text was found. Keep this PDF as reference only or upload a born-digital version.',
          ingestionToken: null,
          updatedAt: sql`greatest(clock_timestamp(), ${documents.updatedAt} + interval '1 millisecond')`,
        })
        .where(eq(documents.id, documentId));
      return rows.map((row) => DocumentChunkId.parse(row.id));
    });
  }

  failIngestion(tenantId: TenantId, documentId: DocumentId, token: string, message: string) {
    return withTenant(this.#db, tenantId, async (tx) => {
      await tx
        .update(documents)
        .set({
          status: 'failed',
          processingError: message,
          ingestionToken: null,
          updatedAt: sql`greatest(clock_timestamp(), ${documents.updatedAt} + interval '1 millisecond')`,
        })
        .where(
          and(
            eq(documents.tenantId, tenantId),
            eq(documents.id, documentId),
            eq(documents.ingestionToken, token),
          ),
        );
    });
  }

  /** Durable intent recovery: queue outage and crashed claims need no repeat upload.
   * Failed PDFs are left for explicit retry (avoid endlessly retrying poison inputs). */
  async pendingWork(): Promise<
    {
      tenantId: TenantId;
      documentIds: DocumentId[];
      chunkIds: DocumentChunkId[];
      deletedKeys: string[];
    }[]
  > {
    const tenantRows = await this.#db.select({ id: tenants.id }).from(tenants);
    return Promise.all(
      tenantRows.map(async (tenant) => {
        const tenantId = TenantId.parse(tenant.id);
        return withTenant(this.#db, tenantId, async (tx) => {
          const docs = await tx
            .select({ id: documents.id })
            .from(documents)
            .where(
              and(
                eq(documents.tenantId, tenantId),
                eq(documents.indexable, true),
                eq(documents.publication, 'draft'),
                sql`${documents.deletedAt} is null and (${documents.status} = 'uploaded' or (${documents.status} = 'processing' and ${documents.updatedAt} < now() - interval '15 minutes'))`,
              ),
            )
            .limit(100);
          const chunks = await tx
            .select({ id: documentChunks.id })
            .from(documentChunks)
            .innerJoin(documents, eq(documents.id, documentChunks.documentId))
            .where(
              and(
                eq(documentChunks.tenantId, tenantId),
                eq(documents.indexable, true),
                sql`${documents.deletedAt} is null and ${documentChunks.embedding} is null and ${documentChunks.tier} <> 'T4'`,
              ),
            )
            .limit(500);
          const deleted = await tx
            .select({ key: documents.storageKey })
            .from(documents)
            .where(and(eq(documents.tenantId, tenantId), sql`${documents.deletedAt} is not null`))
            .limit(100);
          return {
            tenantId,
            documentIds: docs.map((d) => DocumentId.parse(d.id)),
            chunkIds: chunks.map((c) => DocumentChunkId.parse(c.id)),
            deletedKeys: deleted.map((d) => d.key),
          };
        });
      }),
    );
  }

  /** Preflight for callers that store source bytes before inserting a document. */
  validateScope(tenantId: TenantId, input: unknown): Promise<void> {
    const scope = parseDocumentScope(input);
    return withTenant(this.#db, tenantId, (tx) => assertDocumentScope(tx, tenantId, scope));
  }

  createDocument(tenantId: TenantId, input: CreateDocumentInput): Promise<DocumentId> {
    const scope = parseDocumentScope(input);
    return withTenant(this.#db, tenantId, async (tx) => {
      await assertDocumentScope(tx, tenantId, scope);
      const inserted = await tx
        .insert(documents)
        .values({
          ...(input.id ? { id: input.id } : {}),
          tenantId,
          tier: input.tier,
          sourceType: input.sourceType,
          ...(input.category ? { category: input.category } : {}),
          ...(input.indexable !== undefined ? { indexable: input.indexable } : {}),
          title: input.title,
          storageKey: input.storageKey,
          familyId: input.familyId ?? null,
          modelId: input.modelId ?? null,
          companyId: input.companyId ?? null,
          serialId: input.serialId ?? null,
          installationId: input.installationId ?? null,
          docKey: input.docKey ?? null,
          revisionLabel: input.revisionLabel ?? null,
          originalFilename: input.originalFilename ?? null,
          mimeType: input.mimeType ?? null,
          fileHash: input.fileHash ?? null,
          status: 'uploaded',
        })
        .returning({ id: documents.id });
      return DocumentId.parse(inserted[0]!.id);
    });
  }

  loadForIngest(tenantId: TenantId, documentId: DocumentId): Promise<IngestableDocument | null> {
    return withTenant(this.#db, tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: documents.id,
          tier: documents.tier,
          title: documents.title,
          storageKey: documents.storageKey,
        })
        .from(documents)
        .where(and(eq(documents.tenantId, tenantId), eq(documents.id, documentId)))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        id: DocumentId.parse(row.id),
        tier: row.tier,
        title: row.title,
        storageKey: row.storageKey,
      };
    });
  }

  setStatus(tenantId: TenantId, documentId: DocumentId, status: DocumentStatus): Promise<void> {
    return withTenant(this.#db, tenantId, async (tx) => {
      await tx
        .update(documents)
        .set({
          status,
          updatedAt: sql`greatest(clock_timestamp(), ${documents.updatedAt} + interval '1 millisecond')`,
        })
        .where(and(eq(documents.tenantId, tenantId), eq(documents.id, documentId)));
    });
  }

  replaceChunks(
    tenantId: TenantId,
    documentId: DocumentId,
    tier: KnowledgeTier,
    chunks: readonly ChunkInsert[],
  ): Promise<DocumentChunkId[]> {
    return withTenant(this.#db, tenantId, async (tx) => {
      // Idempotent reprocess: drop the old chunks, then insert the fresh set.
      await tx
        .delete(documentChunks)
        .where(
          and(eq(documentChunks.tenantId, tenantId), eq(documentChunks.documentId, documentId)),
        );
      if (chunks.length === 0) return [];
      const inserted = await tx
        .insert(documentChunks)
        .values(
          chunks.map((c) => ({
            tenantId,
            documentId,
            tier,
            chunkIndex: c.chunkIndex,
            chunkType: c.chunkType,
            page: c.page,
            pageEnd: c.pageEnd,
            sectionPath: c.sectionPath,
            sectionTitle: c.sectionTitle,
            content: c.content,
            contextualText: c.contextualText,
            aiMayCite: c.aiMayCite,
            forbiddenForCustomerFacing: c.forbiddenForCustomerFacing,
          })),
        )
        .returning({ id: documentChunks.id });
      return inserted.map((r) => DocumentChunkId.parse(r.id));
    });
  }

  completeIngestion(
    tenantId: TenantId,
    documentId: DocumentId,
    meta: IngestionMetadata,
  ): Promise<void> {
    return withTenant(this.#db, tenantId, async (tx) => {
      await tx
        .update(documents)
        .set({
          status: 'ingested',
          pageCount: meta.pageCount,
          // COALESCE so parser-detected values only fill gaps — a user-declared docKey /
          // revision on upload always wins over the regex-detected one.
          docKey: meta.docKey
            ? sql`coalesce(${documents.docKey}, ${meta.docKey})`
            : documents.docKey,
          revisionLabel: meta.revisionLabel
            ? sql`coalesce(${documents.revisionLabel}, ${meta.revisionLabel})`
            : documents.revisionLabel,
          // Bind the date as an ISO string + explicit cast — a raw `Date` inside a
          // `sql` template can't be bound by the postgres-js driver.
          effectiveFrom: meta.effectiveFrom
            ? sql`coalesce(${documents.effectiveFrom}, ${meta.effectiveFrom.toISOString()}::timestamptz)`
            : documents.effectiveFrom,
          updatedAt: sql`greatest(clock_timestamp(), ${documents.updatedAt} + interval '1 millisecond')`,
        })
        .where(and(eq(documents.tenantId, tenantId), eq(documents.id, documentId)));
    });
  }
}
