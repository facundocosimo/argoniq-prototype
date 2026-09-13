import { createHash, randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DocumentId } from '@argoniq/core-domain';
import { getEnv } from '@argoniq/core-domain/env';
import { type DocumentRow, assertDocumentScope, auditLog, documents } from '@argoniq/db';
import { getJobProducer } from '@argoniq/jobs';
import { documentSourceKey } from '@argoniq/storage';
import { ConflictError, NotFoundError, ValidationError } from '@argoniq/observability';
import type { ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { resolveStoragePort } from './storage.js';
import { REVISION_IDENTITY_FIELDS, UploadDocumentMeta } from './document-input.js';
export { UploadDocumentMeta } from './document-input.js';
export interface UploadedFile {
  readonly bytes: Uint8Array;
  readonly filename: string;
  readonly contentType: string;
}
export const MAX_DOCUMENT_BYTES = 40 * 1024 * 1024;

export async function uploadDocument(
  ctx: ServiceContext,
  file: UploadedFile,
  rawMeta: unknown,
): Promise<DocumentRow> {
  ctx.policy.assertCan('create', 'Document');
  const meta = parseInput(UploadDocumentMeta, rawMeta);
  if (!file.bytes.length || file.bytes.length > MAX_DOCUMENT_BYTES)
    throw new ValidationError('Choose a PDF between 1 byte and 40 MB.');
  if (!/^%PDF-\d\.\d/.test(Buffer.from(file.bytes.subarray(0, 8)).toString('ascii')))
    throw new ValidationError('Only PDF files are supported.');
  const fileHash = createHash('sha256').update(file.bytes).digest('hex');
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ meta, fileHash, filename: file.filename }))
    .digest('hex');
  const storage = resolveStoragePort();
  let storedKey: string | undefined;
  let row: DocumentRow;
  try {
    row = await ctx.withTenant(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${ctx.tenantId + meta.uploadKey}, 0))`,
      );
      const [existing] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.tenantId, ctx.tenantId), eq(documents.uploadKey, meta.uploadKey)));
      if (existing) {
        if (existing.uploadFingerprint !== fingerprint || existing.deletedAt)
          throw new ConflictError(
            'This upload request already belongs to another file or was deleted. Start a new upload.',
          );
        return existing;
      }
      await assertDocumentScope(tx, ctx.tenantId, meta);
      const id = DocumentId.parse(randomUUID());
      let revisionGroupId: string = id;
      let revisionNumber = 1;
      if (meta.previousDocumentId) {
        const [previous] = await tx
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.tenantId, ctx.tenantId),
              eq(documents.id, meta.previousDocumentId),
              isNull(documents.deletedAt),
            ),
          );
        if (!previous) throw new NotFoundError('previous revision');
        for (const field of REVISION_IDENTITY_FIELDS) {
          if ((meta[field] ?? null) !== previous[field])
            throw new ValidationError(
              'A replacement revision must retain its document identity, language and applicability.',
            );
        }
        revisionGroupId = previous.revisionGroupId;
      }
      // Also serialize new identities, so accidental duplicate logical documents are rejected.
      const identity = JSON.stringify(REVISION_IDENTITY_FIELDS.map((field) => meta[field] ?? null));
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${ctx.tenantId + identity}, 0))`,
      );
      if (!meta.previousDocumentId) {
        const existingIdentity = await tx
          .select({ id: documents.id })
          .from(documents)
          .where(
            and(
              eq(documents.tenantId, ctx.tenantId),
              isNull(documents.deletedAt),
              ...REVISION_IDENTITY_FIELDS.map((field) =>
                meta[field] == null ? isNull(documents[field]) : eq(documents[field], meta[field]),
              ),
            ),
          )
          .limit(1);
        if (existingIdentity.length)
          throw new ConflictError(
            'This document identity already exists. Open it and choose Upload new revision.',
          );
      }
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${revisionGroupId}, 0))`);
      const revisions = await tx
        .select({ number: documents.revisionNumber, label: documents.revisionLabel })
        .from(documents)
        .where(
          and(eq(documents.tenantId, ctx.tenantId), eq(documents.revisionGroupId, revisionGroupId)),
        );
      if (revisions.some((r) => r.label === meta.revisionLabel))
        throw new ConflictError('This revision label already exists. Choose a new revision label.');
      revisionNumber = Math.max(0, ...revisions.map((r) => r.number)) + 1;
      storedKey = documentSourceKey(ctx.tenantId, id);
      await storage.put(storedKey, file.bytes, 'application/pdf');
      const { uploadKey, previousDocumentId: _previous, ...metadata } = meta;
      const [created] = await tx
        .insert(documents)
        .values({
          ...metadata,
          id,
          tenantId: ctx.tenantId,
          revisionGroupId,
          revisionNumber,
          isCurrent: false,
          publication: 'draft',
          storageKey: storedKey,
          fileHash,
          uploadKey,
          uploadFingerprint: fingerprint,
          originalFilename: file.filename.slice(0, 512),
          mimeType: 'application/pdf',
        })
        .returning();
      await tx.insert(auditLog).values({
        tenantId: ctx.tenantId,
        userId: ctx.actor.userId,
        kind: 'access',
        action: 'document.uploaded',
        payload: { documentId: id, fileHash, revisionGroupId },
      });
      return created!;
    });
  } catch (error) {
    if (storedKey) {
      const key = storedKey;
      // A lost commit acknowledgement is ambiguous: never remove a committed source.
      await ctx
        .withTenant(async (tx) => {
          const committed = await tx
            .select({ id: documents.id })
            .from(documents)
            .where(and(eq(documents.tenantId, ctx.tenantId), eq(documents.storageKey, key)))
            .limit(1);
          if (!committed.length) await storage.delete(key);
        })
        .catch((cleanup) =>
          ctx.logger.error({ err: cleanup }, 'source cleanup needs reconciliation'),
        );
    }
    throw error;
  }
  // The persisted uploaded state is durable enqueue intent. The worker reconciles it.
  if (row.indexable && row.status === 'uploaded') {
    try {
      const env = getEnv();
      await (
        await getJobProducer(env.PGBOSS_DATABASE_URL ?? env.DATABASE_URL)
      ).enqueueIngestDocument({ tenantId: ctx.tenantId, documentId: DocumentId.parse(row.id) });
    } catch (error) {
      ctx.logger.error(
        { err: error, documentId: row.id },
        'document saved; worker will recover enqueue',
      );
    }
  }
  return row;
}
