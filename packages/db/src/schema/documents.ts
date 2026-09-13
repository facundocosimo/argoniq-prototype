import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { documentCategoryEnum, knowledgeTierEnum, pk, tenantId, timestamps } from './_shared.js';
import { companies } from './companies.js';
import { installations } from './installations.js';
import { machineFamilies } from './machine-families.js';
import { machineModels } from './machine-models.js';
import { serials } from './serials.js';
import { tenants } from './tenants.js';

/** How a document entered the system — the channel that *sets its tier* ( step 1). */
export const documentSourceTypeEnum = pgEnum('document_source_type', [
  'manual_pdf',
  'structured_export',
  'case_history',
  'field_photo',
  'service_bulletin',
]);

export const documentStatusEnum = pgEnum('document_status', [
  'uploaded',
  'processing',
  'ingested',
  'failed',
]);

/**
 * The applicability altitude of a document→entity scope link (
 * "tag at the broadest valid scope"). `family` = reusable across a whole family;
 * `model` = a model-specific revision. Company/serial *ownership* (T2) stays on
 * the document row itself; scopes express *applicability* across the type catalog.
 */
export const documentScopeTypeEnum = pgEnum('document_scope_type', ['family', 'model']);

/**
 * Documents — the knowledge corpus. `tier` is assigned by ingestion channel,
 * never inferred. T2 (customer-specific) docs carry a `companyId`/`serialId`
 * scope; T1 are tenant-wide. T4 (restricted) is additionally credential-isolated
 * at the storage layer. Tenant-scoped (RLS).
 *
 * Revision model: each row is one immutable *revision* of a logical document. A
 * logical document is the set of rows sharing `(tenantId, docKey)` (e.g. part
 * number "ATLAS-REF-01"); `revisionLabel`/`revisionNumber` order them and `isCurrent`
 * marks the effective one. Superseding a revision sets the old row's
 * `supersededById` to the new row and flips `isCurrent` — history is retained,
 * never mutated in place.
 *
 * Applicability: the *primary* scope is the denormalized `familyId`/`modelId`
 * pair (kept for the fast retrieval index); additional family/model targets live
 * in `document_scopes` for full flexibility (one manual → many models).
 */
export const documents = pgTable(
  'documents',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    tier: knowledgeTierEnum('tier').notNull(),
    /** How the document entered the system (the ingestion channel that set its tier). */
    sourceType: documentSourceTypeEnum('source_type').notNull(),
    /**
     * WHAT KIND of artifact this is (operation manual, schematic, certificate…) —
     * orthogonal to tier/scope/format. Drives catalog filtering + the coverage matrix.
     */
    category: documentCategoryEnum('category').notNull().default('other'),
    /**
     * Whether this document is eligible for AI retrieval (chunked + embedded + returned).
     * False for binary artifacts (PLC backups, CAD source): they stay in the library and
     * are downloadable, but never enter the RAG corpus. Retrieval eligibility ANDs this in.
     */
    indexable: boolean('indexable').notNull().default(true),
    title: varchar('title', { length: 400 }).notNull(),
    /**
     * Logical-document identity — the publisher key (e.g. "ATLAS-REF-01") or a
     * derived stable key. Rows sharing `(tenantId, docKey)` are revisions of the
     * same document. Null → the document is its own single-revision identity (by id).
     */
    docKey: varchar('doc_key', { length: 120 }),
    /** Human revision stamp as printed on the document ("C", "Rev C", "2.1"). */
    revisionLabel: varchar('revision_label', { length: 40 }),
    /** Monotonic order of this revision within `docKey` (1, 2, 3…); "latest" tiebreak. */
    revisionNumber: integer('revision_number').notNull().default(1),
    /** Legacy compatibility flag. Read services derive current status from publication/effective date within revisionGroupId. */
    isCurrent: boolean('is_current').notNull().default(true),
    /** The newer revision that supersedes this one; null = not superseded. Self-ref chain. */
    supersededById: uuid('superseded_by_id').references((): AnyPgColumn => documents.id, {
      onDelete: 'set null',
    }),
    /** Revision date as stated in the document's revision history (e.g. 2021-04-01). */
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    /** BCP-47-ish language of the source (  multilingual reality). */
    language: varchar('language', { length: 8 }).notNull().default('en'),
    /** Primary applicability: the family this revision belongs to. */
    familyId: uuid('family_id'),
    /** Primary applicability: the model this revision is specific to (null = family-wide). */
    modelId: uuid('model_id'),
    companyId: uuid('company_id'),
    serialId: uuid('serial_id'),
    /** Line-level docs: the whole-line P&ID / electrical schematic / FAT report. */
    installationId: uuid('installation_id'),
    storageKey: varchar('storage_key', { length: 1024 }).notNull(),
    /** SHA-256 of the source bytes — dedup, integrity, and change detection on re-upload. */
    fileHash: varchar('file_hash', { length: 64 }),
    originalFilename: varchar('original_filename', { length: 512 }),
    mimeType: varchar('mime_type', { length: 120 }),
    pageCount: integer('page_count'),
    status: documentStatusEnum('status').notNull().default('uploaded'),
    publication: varchar('publication', { length: 20 }).notNull().default('draft'),
    revisionGroupId: uuid('revision_group_id').notNull().defaultRandom(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ingestionToken: uuid('ingestion_token'),
    processingError: text('processing_error'),
    extractionReport: jsonb('extraction_report').$type<{
      pages: number;
      textPages: number;
      reviewChunks: number;
    }>(),
    uploadKey: uuid('upload_key'),
    uploadFingerprint: varchar('upload_fingerprint', { length: 64 }),
    ...timestamps(),
  },
  (t) => [
    index('documents_effective_idx')
      .on(t.tenantId, t.revisionGroupId, t.effectiveFrom)
      .where(sql`${t.publication} = 'approved' and ${t.deletedAt} is null`),
    check(
      'documents_publication_ck',
      sql`${t.publication} in ('draft', 'in_review', 'approved', 'withdrawn')`,
    ),
    uniqueIndex('documents_upload_key_uq').on(t.tenantId, t.uploadKey),
    uniqueIndex('documents_group_label_uq').on(t.tenantId, t.revisionGroupId, t.revisionLabel),
    uniqueIndex('documents_group_revision_uq').on(t.tenantId, t.revisionGroupId, t.revisionNumber),
    index('documents_tenant_idx').on(t.tenantId),
    index('documents_tenant_tier_idx').on(t.tenantId, t.tier),
    index('documents_family_idx').on(t.familyId),
    index('documents_model_idx').on(t.modelId),
    index('documents_dockey_idx').on(t.tenantId, t.docKey),
    uniqueIndex('documents_tenant_id_uq').on(t.tenantId, t.id),
    uniqueIndex('documents_tenant_id_tier_uq').on(t.tenantId, t.id, t.tier),
    // Mirrors DocumentScope's audience/ownership matrix. Composite references
    // also reject later reassignments that would invalidate an existing scope.
    check(
      'documents_audience_ownership_ck',
      sql`
      (${t.tier} <> 'T2' OR ${t.companyId} IS NOT NULL)
      AND (${t.tier} NOT IN ('T1', 'T3') OR (${t.companyId} IS NULL AND ${t.serialId} IS NULL AND ${t.installationId} IS NULL))
      AND ((${t.serialId} IS NULL AND ${t.installationId} IS NULL) OR ${t.companyId} IS NOT NULL)
    `,
    ),
    foreignKey({
      name: 'documents_tenant_company_fk',
      columns: [t.tenantId, t.companyId],
      foreignColumns: [companies.tenantId, companies.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'documents_tenant_family_fk',
      columns: [t.tenantId, t.familyId],
      foreignColumns: [machineFamilies.tenantId, machineFamilies.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'documents_tenant_model_fk',
      columns: [t.tenantId, t.modelId],
      foreignColumns: [machineModels.tenantId, machineModels.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'documents_tenant_model_family_fk',
      columns: [t.tenantId, t.modelId, t.familyId],
      foreignColumns: [machineModels.tenantId, machineModels.id, machineModels.familyId],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'documents_tenant_serial_company_fk',
      columns: [t.tenantId, t.serialId, t.companyId],
      foreignColumns: [serials.tenantId, serials.id, serials.companyId],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'documents_tenant_serial_family_fk',
      columns: [t.tenantId, t.serialId, t.familyId],
      foreignColumns: [serials.tenantId, serials.id, serials.familyId],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'documents_tenant_serial_model_fk',
      columns: [t.tenantId, t.serialId, t.modelId],
      foreignColumns: [serials.tenantId, serials.id, serials.modelId],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'documents_tenant_installation_company_fk',
      columns: [t.tenantId, t.installationId, t.companyId],
      foreignColumns: [installations.tenantId, installations.id, installations.companyId],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'documents_tenant_serial_installation_fk',
      columns: [t.tenantId, t.serialId, t.installationId],
      foreignColumns: [serials.tenantId, serials.id, serials.installationId],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
  ],
);

/**
 * Additional family/model applicability targets for a document, beyond the
 * primary `documents.familyId`/`modelId`. Lets one manual apply to several models
 * (or several families) without duplicating the file. Retrieval eligibility ORs
 * these in alongside the primary scope. Tenant-scoped (RLS).
 */
export const documentScopes = pgTable(
  'document_scopes',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id').notNull(),
    scopeType: documentScopeTypeEnum('scope_type').notNull(),
    familyId: uuid('family_id'),
    modelId: uuid('model_id'),
    ...timestamps(),
  },
  (t) => [
    index('document_scopes_tenant_idx').on(t.tenantId),
    index('document_scopes_document_idx').on(t.documentId),
    index('document_scopes_family_idx').on(t.familyId),
    index('document_scopes_model_idx').on(t.modelId),
    uniqueIndex('document_scopes_uq').on(t.documentId, t.familyId, t.modelId),
    check(
      'document_scopes_target_ck',
      sql`
      (${t.scopeType} = 'family' AND ${t.familyId} IS NOT NULL AND ${t.modelId} IS NULL)
      OR (${t.scopeType} = 'model' AND ${t.modelId} IS NOT NULL)
    `,
    ),
    foreignKey({
      name: 'document_scopes_tenant_document_fk',
      columns: [t.tenantId, t.documentId],
      foreignColumns: [documents.tenantId, documents.id],
    })
      .onDelete('cascade')
      .onUpdate('restrict'),
    foreignKey({
      name: 'document_scopes_tenant_family_fk',
      columns: [t.tenantId, t.familyId],
      foreignColumns: [machineFamilies.tenantId, machineFamilies.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'document_scopes_tenant_model_fk',
      columns: [t.tenantId, t.modelId],
      foreignColumns: [machineModels.tenantId, machineModels.id],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    foreignKey({
      name: 'document_scopes_tenant_model_family_fk',
      columns: [t.tenantId, t.modelId, t.familyId],
      foreignColumns: [machineModels.tenantId, machineModels.id, machineModels.familyId],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
  ],
);

/**
 * Retrievable chunks for RAG. `tier` is denormalized for fast filtered
 * retrieval and provenance. `contextualText` is the Contextual-Retrieval prefix
 * (deterministic breadcrumb by default; Haiku-generated when retrieval is weak)
 * prepended before embedding. Hybrid search combines the `embedding` (vector)
 * with a BM25/tsvector index added in the SQL migration step.
 *
 * `sectionPath`/`sectionTitle` capture the document's own numbering (e.g. "6.4",
 * "Demo Network") — the semantic provenance unit, cited alongside
 * the page. `chunkType` distinguishes prose from atomic table/figure chunks (a
 * table is never split across its header/row boundary). Per-chunk governance flags
 * (`aiMayCite`, `forbiddenForCustomerFacing`) let the answer pipeline filter at
 * chunk granularity, not only by document tier.
 */
export const documentChunkTypeEnum = pgEnum('document_chunk_type', [
  'prose',
  'table',
  'figure',
  'caption',
]);

export const documentChunks = pgTable(
  'document_chunks',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id').notNull(),
    tier: knowledgeTierEnum('tier').notNull(),
    page: integer('page'),
    /** Last page of the chunk when it spans a boundary (e.g. a table); null = single page. */
    pageEnd: integer('page_end'),
    /** The document's own section number, e.g. "6.4" — the semantic provenance unit. */
    sectionPath: varchar('section_path', { length: 120 }),
    sectionTitle: varchar('section_title', { length: 400 }),
    chunkType: documentChunkTypeEnum('chunk_type').notNull().default('prose'),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    contextualText: text('contextual_text'),
    /** Whether the answer pipeline may quote this chunk to a customer. */
    aiMayCite: boolean('ai_may_cite').notNull().default(true),
    /** Hard block from any customer-facing channel regardless of tier (defense in depth). */
    forbiddenForCustomerFacing: boolean('forbidden_for_customer_facing').notNull().default(false),
    embedding: vector('embedding', { dimensions: 1024 }),
    /** Legacy untagged vectors are excluded from dense search until re-embedded. */
    embeddingModel: varchar('embedding_model', { length: 200 }),
    embeddingInputHash: varchar('embedding_input_hash', { length: 64 }),
    ...timestamps(),
  },
  (t) => [
    index('document_chunks_tenant_idx').on(t.tenantId),
    index('document_chunks_document_idx').on(t.documentId),
    foreignKey({
      name: 'document_chunks_tenant_document_tier_fk',
      columns: [t.tenantId, t.documentId, t.tier],
      foreignColumns: [documents.tenantId, documents.id, documents.tier],
    })
      .onDelete('cascade')
      .onUpdate('restrict'),
    index('document_chunks_tenant_tier_idx').on(t.tenantId, t.tier),
  ],
);

export type DocumentRow = typeof documents.$inferSelect;
export type NewDocumentRow = typeof documents.$inferInsert;
export type DocumentScopeRow = typeof documentScopes.$inferSelect;
export type NewDocumentScopeRow = typeof documentScopes.$inferInsert;
export type DocumentChunkRow = typeof documentChunks.$inferSelect;
export type NewDocumentChunkRow = typeof documentChunks.$inferInsert;
