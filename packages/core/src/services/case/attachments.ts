import { createHash, randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  MAX_CASE_FILE_BYTES,
  MAX_CASE_TOTAL_BYTES,
  MAX_CASE_FILES,
  SerialId,
} from '@argoniq/core-domain';
import { caseAttachments, cases, serials, type TenantTransaction } from '@argoniq/db';
import { ConflictError, NotFoundError, ValidationError } from '@argoniq/observability';
import { type StoragePort } from '@argoniq/storage';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { resolveStoragePort } from '../document/storage.js';

export const CaseAttachmentDraftInput = z.object({ serialId: SerialId, submissionKey: z.uuid() });
export const CaseAttachmentIdInput = z.object({ attachmentId: z.uuid() });
export async function authorizedCaseMachine(
  ctx: ServiceContext,
  tx: TenantTransaction,
  serialId: string,
) {
  const [machine] = await tx
    .select()
    .from(serials)
    .where(eq(serials.id, serialId))
    .limit(1)
    .for('share');
  if (!machine) throw new NotFoundError('machine');
  ctx.policy.assertCan('read', 'Serial', { id: machine.id, companyId: machine.companyId });
  ctx.policy.assertCan('create', 'Case', { companyId: machine.companyId });
  return machine;
}
/** Serialize upload, removal and confirmation for one draft, including concurrent tabs. */
export async function lockCaseDraft(
  tx: TenantTransaction,
  tenantId: string,
  submissionKey: string,
) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${tenantId + ':' + submissionKey}, 0))`,
  );
}
export function validateCaseFile(
  bytes: Uint8Array,
  filename: string,
): { filename: string; contentType: string } {
  if (!bytes.length || bytes.length > MAX_CASE_FILE_BYTES)
    throw new ValidationError('Choose a non-empty file of 10 MB or less.');
  // eslint-disable-next-line no-control-regex -- untrusted filenames cannot contain control characters.
  const name = filename.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 180);
  const ext = name.split('.').pop()?.toLowerCase();
  const b = Buffer.from(bytes);
  let contentType: string | undefined;
  if (['jpg', 'jpeg'].includes(ext ?? '') && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    contentType = 'image/jpeg';
  if (ext === 'png' && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    contentType = 'image/png';
  if (
    ext === 'webp' &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP'
  )
    contentType = 'image/webp';
  if (ext === 'pdf' && b.toString('ascii', 0, 5) === '%PDF-') contentType = 'application/pdf';
  if (ext === 'mp4' && b.toString('ascii', 4, 8) === 'ftyp') contentType = 'video/mp4';
  if (['txt', 'log', 'csv'].includes(ext ?? '') && !b.includes(0)) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      contentType = 'text/plain';
    } catch {
      /* Reject non-UTF8 text. */
    }
  }
  if (!contentType)
    throw new ValidationError(
      'Use JPG, PNG, WebP, PDF, MP4 or UTF-8 text, CSV and log files with matching contents.',
    );
  return { filename: name, contentType };
}
export const attachmentView = (row: typeof caseAttachments.$inferSelect) => ({
  id: row.id,
  filename: row.filename,
  size: row.size,
  contentType: row.contentType,
});
export async function listCaseDraftAttachments(ctx: ServiceContext, input: unknown) {
  const data = parseInput(CaseAttachmentDraftInput, input);
  return ctx.withTenant(async (tx) => {
    await authorizedCaseMachine(ctx, tx, data.serialId);
    return (
      await tx
        .select()
        .from(caseAttachments)
        .where(
          and(
            eq(caseAttachments.submissionKey, data.submissionKey),
            eq(caseAttachments.serialId, data.serialId),
            eq(caseAttachments.uploadedBy, ctx.actor.userId),
            isNull(caseAttachments.caseId),
          ),
        )
    ).map(attachmentView);
  });
}
export async function uploadCaseAttachment(
  ctx: ServiceContext,
  input: unknown,
  file: { bytes: Uint8Array; filename: string },
  storage: StoragePort = resolveStoragePort(),
) {
  const data = parseInput(CaseAttachmentDraftInput, input);
  ctx.policy.assertCan('create', 'Case');
  const meta = validateCaseFile(file.bytes, file.filename);
  const id = randomUUID();
  const storageKey = `tenants/${ctx.tenantId}/case-evidence/${id}`;
  let stored = false;
  try {
    return await ctx.withTenant(async (tx) => {
      await authorizedCaseMachine(ctx, tx, data.serialId);
      await lockCaseDraft(tx, ctx.tenantId, data.submissionKey);
      if (
        (
          await tx
            .select({ id: cases.id })
            .from(cases)
            .where(eq(cases.submissionKey, data.submissionKey))
        ).length
      )
        throw new ConflictError('This request has already been submitted.');
      const existing = await tx
        .select()
        .from(caseAttachments)
        .where(eq(caseAttachments.submissionKey, data.submissionKey));
      for (const previous of existing) {
        if (
          previous.uploadedBy === ctx.actor.userId &&
          previous.serialId === data.serialId &&
          previous.filename === meta.filename &&
          previous.size === file.bytes.length &&
          createHash('sha256')
            .update(await storage.get(previous.storageKey))
            .digest('hex') === createHash('sha256').update(file.bytes).digest('hex')
        )
          return attachmentView(previous);
      }
      if (
        existing.length >= MAX_CASE_FILES ||
        existing.reduce((sum, f) => sum + f.size, 0) + file.bytes.length > MAX_CASE_TOTAL_BYTES
      )
        throw new ValidationError(
          'Use up to 5 attachments, 20 MB in total. Remove a file before adding another.',
        );
      await storage.put(storageKey, file.bytes, meta.contentType);
      stored = true;
      const [row] = await tx
        .insert(caseAttachments)
        .values({
          id,
          tenantId: ctx.tenantId,
          serialId: data.serialId,
          uploadedBy: ctx.actor.userId,
          submissionKey: data.submissionKey,
          storageKey,
          size: file.bytes.length,
          ...meta,
        })
        .returning();
      return attachmentView(row!);
    });
  } catch (error) {
    if (stored) await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
}
export async function removeCaseDraftAttachment(
  ctx: ServiceContext,
  input: unknown,
  storage: StoragePort = resolveStoragePort(),
) {
  const { attachmentId } = parseInput(CaseAttachmentIdInput, input);
  const storageKey = await ctx.withTenant(async (tx) => {
    const [before] = await tx
      .select()
      .from(caseAttachments)
      .where(eq(caseAttachments.id, attachmentId));
    if (before?.uploadedBy !== ctx.actor.userId) throw new NotFoundError('attachment');
    await authorizedCaseMachine(ctx, tx, before.serialId);
    await lockCaseDraft(tx, ctx.tenantId, before.submissionKey);
    const [row] = await tx
      .delete(caseAttachments)
      .where(and(eq(caseAttachments.id, attachmentId), isNull(caseAttachments.caseId)))
      .returning();
    if (!row) throw new ConflictError('Submitted evidence cannot be removed from a draft.');
    return row.storageKey;
  });
  await storage.delete(storageKey);
  return { removed: true };
}
export async function downloadCaseAttachment(
  ctx: ServiceContext,
  input: unknown,
  storage: StoragePort = resolveStoragePort(),
) {
  const { attachmentId } = parseInput(CaseAttachmentIdInput, input);
  const row = await ctx.withTenant(async (tx) => {
    const [attachment] = await tx
      .select()
      .from(caseAttachments)
      .where(eq(caseAttachments.id, attachmentId));
    if (!attachment) throw new NotFoundError('attachment');
    if (attachment.caseId) {
      const [record] = await tx.select().from(cases).where(eq(cases.id, attachment.caseId));
      if (!record) throw new NotFoundError('case');
      ctx.policy.assertCan('read', 'Case', { id: record.id, companyId: record.companyId });
    } else {
      if (attachment.uploadedBy !== ctx.actor.userId) throw new NotFoundError('attachment');
      await authorizedCaseMachine(ctx, tx, attachment.serialId);
    }
    return attachment;
  });
  return { ...attachmentView(row), bytes: await storage.get(row.storageKey) };
}
