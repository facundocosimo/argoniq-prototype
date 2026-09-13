import { withUniqueConflict } from '../db-errors.js';
import { documentMachineEligibility, readableDocument } from './eligibility.js';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { DocumentId, DocumentScope } from '@argoniq/core-domain';
import {
  assertDocumentScope,
  auditLog,
  documentChunks,
  documents,
  type TenantTransaction,
} from '@argoniq/db';
import { ConflictError, NotFoundError, ValidationError } from '@argoniq/observability';
import type { ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { DocumentMetadata, REVISION_IDENTITY_FIELDS } from './document-input.js';
import { resolveStoragePort } from './storage.js';

const VersionedDocument = z.object({ documentId: DocumentId, updatedAt: z.coerce.date() });
export const UpdateDocumentInput = VersionedDocument.and(DocumentMetadata);
export const TransitionDocumentInput = VersionedDocument.extend({
  action: z.enum(['submit', 'return_to_draft', 'publish', 'withdraw', 'restore', 'delete']),
  reason: z.string().trim().min(3).max(1000),
  effectiveFrom: z.coerce.date().optional(),
});
export const ReviewExtractionInput = VersionedDocument.extend({
  offset: z.number().int().min(0).default(0),
});
export const ReviewChunkInput = VersionedDocument.extend({
  chunkId: z.string().uuid(),
  aiMayCite: z.boolean(),
  reason: z.string().trim().min(3).max(1000),
});

async function lockedDocument(
  ctx: ServiceContext,
  tx: TenantTransaction,
  input: z.infer<typeof VersionedDocument>,
) {
  const [doc] = await tx
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, ctx.tenantId),
        eq(documents.id, input.documentId),
        readableDocument(ctx),
      ),
    )
    .for('update');
  if (!doc) throw new NotFoundError('document');
  if (doc.updatedAt.getTime() !== input.updatedAt.getTime())
    throw new ConflictError(
      'This document changed. Refresh and review the latest version before saving.',
    );
  return doc;
}
async function record(
  ctx: ServiceContext,
  tx: TenantTransaction,
  action: string,
  payload: Record<string, unknown>,
) {
  await tx.insert(auditLog).values({
    tenantId: ctx.tenantId,
    userId: ctx.actor.userId,
    kind: 'access',
    action: `document.${action}`,
    payload,
  });
}

export async function updateDocument(ctx: ServiceContext, raw: unknown) {
  ctx.policy.assertCan('update', 'Document');
  const input = parseInput(UpdateDocumentInput, raw);
  return withUniqueConflict('This revision label already exists in the document history.', () =>
    ctx.withTenant(async (tx) => {
      const doc = await lockedDocument(ctx, tx, input);
      if (doc.publication !== 'draft' || doc.publishedAt)
        throw new ConflictError(
          'Only unpublished drafts can be edited. Upload a new revision to change a published document.',
        );
      if (doc.status === 'processing')
        throw new ConflictError('Wait for processing to finish before editing.');
      await assertDocumentScope(tx, ctx.tenantId, input);
      const siblings = await tx
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.tenantId, ctx.tenantId),
            eq(documents.revisionGroupId, doc.revisionGroupId),
          ),
        )
        .limit(2);
      if (
        siblings.length > 1 &&
        REVISION_IDENTITY_FIELDS.some((field) => (input[field] ?? null) !== doc[field])
      )
        throw new ConflictError(
          'Revisions share their identity, language and applicability. Create a separate document to change those fields.',
        );
      const identity = JSON.stringify(
        REVISION_IDENTITY_FIELDS.map((field) => input[field] ?? null),
      );
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${ctx.tenantId + identity}, 0))`,
      );
      const duplicate = await tx
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.tenantId, ctx.tenantId),
            isNull(documents.deletedAt),
            sql`${documents.revisionGroupId} <> ${doc.revisionGroupId}::uuid`,
            ...REVISION_IDENTITY_FIELDS.map((field) =>
              input[field] == null ? isNull(documents[field]) : eq(documents[field], input[field]),
            ),
          ),
        )
        .limit(1);
      if (duplicate.length)
        throw new ConflictError(
          'This document identity already exists. Use a replacement revision from that document.',
        );
      // Review/embedding state belongs to the old metadata and is explicitly invalidated.
      await tx
        .delete(documentChunks)
        .where(
          and(eq(documentChunks.tenantId, ctx.tenantId), eq(documentChunks.documentId, doc.id)),
        );
      const { documentId: _id, updatedAt: _version, ...metadata } = input;
      const [saved] = await tx
        .update(documents)
        .set({
          ...metadata,
          familyId: input.familyId ?? null,
          modelId: input.modelId ?? null,
          companyId: input.companyId ?? null,
          serialId: input.serialId ?? null,
          installationId: input.installationId ?? null,
          status: 'uploaded',
          ingestionToken: null,
          processingError: null,
          extractionReport: null,
          updatedAt: new Date(Math.max(Date.now(), doc.updatedAt.getTime() + 1)),
        })
        .where(eq(documents.id, doc.id))
        .returning();
      await record(ctx, tx, 'edited', {
        documentId: doc.id,
        before: { title: doc.title, tier: doc.tier, language: doc.language },
        after: metadata,
      });
      return saved!;
    }),
  );
}

export async function transitionDocument(ctx: ServiceContext, raw: unknown) {
  const input = parseInput(TransitionDocumentInput, raw);
  ctx.policy.assertCan(
    input.action === 'delete'
      ? 'delete'
      : ['publish', 'withdraw', 'restore'].includes(input.action)
        ? 'publish'
        : 'update',
    'Document',
  );
  const result = await ctx.withTenant(async (tx) => {
    // Lock the group before the row, consistently with replacement uploads.
    const [group] = await tx
      .select({ id: documents.revisionGroupId })
      .from(documents)
      .where(and(eq(documents.tenantId, ctx.tenantId), eq(documents.id, input.documentId)));
    if (!group) throw new NotFoundError('document');
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${group.id}, 0))`);
    const doc = await lockedDocument(ctx, tx, input);
    const now = new Date(Math.max(Date.now(), doc.updatedAt.getTime() + 1));
    const change: Partial<typeof documents.$inferInsert> = { updatedAt: now };
    switch (input.action) {
      case 'submit':
        if (doc.publication !== 'draft' || doc.publishedAt)
          throw new ConflictError('Only an unpublished draft can be submitted.');
        if (doc.indexable && doc.status !== 'ingested')
          throw new ConflictError(
            'Wait for successful extraction, or save this PDF as reference only.',
          );
        change.publication = 'in_review';
        break;
      case 'return_to_draft':
        if (doc.publication !== 'in_review')
          throw new ConflictError('Only a document in review can be returned to draft.');
        change.publication = 'draft';
        break;
      case 'publish':
        if (!(await resolveStoragePort().exists(doc.storageKey)))
          throw new ValidationError(
            'The source file is unavailable. Restore it before publishing.',
          );
        if (doc.publication !== 'in_review')
          throw new ConflictError('Submit this draft for review before publishing.');
        if (doc.indexable && doc.status !== 'ingested')
          throw new ConflictError('Extraction must complete before publication.');
        if (doc.indexable && !doc.extractionReport)
          throw new ConflictError(
            'Reprocess this source to obtain an extraction report before publishing.',
          );
        change.publication = 'approved';
        change.publishedAt = now;
        change.effectiveFrom = input.effectiveFrom ?? now;
        break;
      case 'withdraw':
        if (doc.publication !== 'approved')
          throw new ConflictError('Only an approved revision can be withdrawn.');
        change.publication = 'withdrawn';
        break;
      case 'restore':
        if (doc.publication !== 'withdrawn' || !doc.publishedAt)
          throw new ConflictError(
            'Only a previously published withdrawn revision can be restored.',
          );
        // A deliberate rollback becomes effective now; original bytes/citations remain intact.
        change.publication = 'approved';
        change.effectiveFrom = input.effectiveFrom ?? now;
        break;
      case 'delete':
        if (doc.publishedAt || doc.publication !== 'draft')
          throw new ConflictError(
            'Only unpublished drafts can be deleted. Withdraw published revisions to retain citation history.',
          );
        if (doc.status === 'processing')
          throw new ConflictError('Wait for processing to finish before deleting.');
        change.deletedAt = now;
        change.ingestionToken = null;
        await tx
          .delete(documentChunks)
          .where(
            and(eq(documentChunks.tenantId, ctx.tenantId), eq(documentChunks.documentId, doc.id)),
          );
        break;
    }
    const [saved] = await tx
      .update(documents)
      .set(change)
      .where(eq(documents.id, doc.id))
      .returning();
    // Compatibility field only; effectiveDocument is the authoritative scheduled resolver.
    await tx
      .update(documents)
      .set({ isCurrent: false })
      .where(
        and(
          eq(documents.tenantId, ctx.tenantId),
          eq(documents.revisionGroupId, doc.revisionGroupId),
        ),
      );
    await record(ctx, tx, input.action, {
      documentId: doc.id,
      reason: input.reason,
      before: doc.publication,
      after: saved!.publication,
      effectiveFrom: saved!.effectiveFrom,
    });
    return saved!;
  });
  if (input.action === 'delete')
    await resolveStoragePort()
      .delete(result.storageKey)
      .catch((error) =>
        ctx.logger.error({ err: error, documentId: result.id }, 'deleted source cleanup pending'),
      );
  return result;
}

export async function reviewExtraction(ctx: ServiceContext, raw: unknown) {
  ctx.policy.assertCan('update', 'Document');
  const input = parseInput(ReviewExtractionInput, raw);
  return ctx.withTenant(async (tx) => {
    await lockedDocument(ctx, tx, input);
    const rows = await tx
      .select({
        id: documentChunks.id,
        page: documentChunks.page,
        type: documentChunks.chunkType,
        content: documentChunks.content,
        aiMayCite: documentChunks.aiMayCite,
      })
      .from(documentChunks)
      .where(
        and(
          eq(documentChunks.tenantId, ctx.tenantId),
          eq(documentChunks.documentId, input.documentId),
        ),
      )
      .orderBy(asc(documentChunks.chunkIndex))
      .limit(11)
      .offset(input.offset);
    return { items: rows.slice(0, 10), hasMore: rows.length > 10 };
  });
}
export async function reviewChunk(ctx: ServiceContext, raw: unknown) {
  ctx.policy.assertCan('publish', 'Document');
  const input = parseInput(ReviewChunkInput, raw);
  return ctx.withTenant(async (tx) => {
    const doc = await lockedDocument(ctx, tx, input);
    if (doc.publication !== 'in_review')
      throw new ConflictError('Extraction can be reviewed only while the document is in review.');
    const [before] = await tx
      .select({ aiMayCite: documentChunks.aiMayCite })
      .from(documentChunks)
      .where(
        and(
          eq(documentChunks.tenantId, ctx.tenantId),
          eq(documentChunks.documentId, doc.id),
          eq(documentChunks.id, input.chunkId),
        ),
      );
    if (!before) throw new NotFoundError('extraction passage');
    await tx
      .update(documentChunks)
      .set({ aiMayCite: input.aiMayCite })
      .where(eq(documentChunks.id, input.chunkId));
    await record(ctx, tx, 'extraction_reviewed', {
      documentId: doc.id,
      chunkId: input.chunkId,
      before: before.aiMayCite,
      after: input.aiMayCite,
      reason: input.reason,
      policy: 'born-digital-review-v1',
    });
    await tx
      .update(documents)
      .set({ updatedAt: new Date(Math.max(Date.now(), doc.updatedAt.getTime() + 1)) })
      .where(eq(documents.id, doc.id));
  });
}

export const PreviewDocumentScopeInput = z.object({
  documentId: DocumentId,
  offset: z.number().int().min(0).default(0),
});
export async function previewDocumentScope(ctx: ServiceContext, raw: unknown) {
  ctx.policy.assertCan('update', 'Document');
  const { documentId, offset } = parseInput(PreviewDocumentScopeInput, raw);
  return ctx.withTenant(async (tx) => {
    const [doc] = await tx
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.tenantId, ctx.tenantId),
          eq(documents.id, documentId),
          isNull(documents.deletedAt),
        ),
      );
    if (!doc) throw new NotFoundError('document');
    const result =
      await tx.execute(sql`select machine.id, machine.serial_number as "serialNumber", company.name as "companyName", count(*) over()::int as total
      from serials machine join companies company on company.id = machine.company_id and company.tenant_id = machine.tenant_id
      where machine.tenant_id = ${ctx.tenantId} and exists (select 1 from documents where documents.tenant_id = ${ctx.tenantId} and documents.id = ${documentId}
        and ${documentMachineEligibility(ctx.tenantId, sql`machine.id`)})
      order by machine.serial_number, machine.id limit 20 offset ${offset}`);
    return result as unknown as {
      id: string;
      serialNumber: string;
      companyName: string;
      total: number;
    }[];
  });
}

export const PreviewUploadScopeInput = DocumentScope.and(
  z.object({ offset: z.number().int().min(0).default(0) }),
);
export async function previewUploadScope(ctx: ServiceContext, raw: unknown) {
  ctx.policy.assertCan('create', 'Document');
  const scope = parseInput(PreviewUploadScopeInput, raw);
  return ctx.withTenant(async (tx) => {
    await assertDocumentScope(tx, ctx.tenantId, scope);
    const result = await tx.execute(sql`with documents as (select null::uuid as id,
      ${scope.companyId ?? null}::uuid as company_id, ${scope.serialId ?? null}::uuid as serial_id,
      ${scope.installationId ?? null}::uuid as installation_id, ${scope.familyId ?? null}::uuid as family_id,
      ${scope.modelId ?? null}::uuid as model_id)
      select machine.id, machine.serial_number as "serialNumber", company.name as "companyName", count(*) over()::int as total
      from serials machine join companies company on company.id = machine.company_id and company.tenant_id = machine.tenant_id
      where machine.tenant_id = ${ctx.tenantId} and exists (select 1 from documents where ${documentMachineEligibility(ctx.tenantId, sql`machine.id`)})
      order by machine.serial_number, machine.id limit 20 offset ${scope.offset}`);
    return result as unknown as {
      id: string;
      serialNumber: string;
      companyName: string;
      total: number;
    }[];
  });
}
