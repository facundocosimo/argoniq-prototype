import { readableDocument } from './eligibility.js';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { DocumentId } from '@argoniq/core-domain';
import { getEnv } from '@argoniq/core-domain/env';
import { documents } from '@argoniq/db';
import { getJobProducer } from '@argoniq/jobs';
import { ConflictError, NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

export const ReprocessDocumentInput = z.object({ documentId: DocumentId });
export type ReprocessDocumentInput = z.infer<typeof ReprocessDocumentInput>;

/**
 * Re-run ingestion for an existing document (after a parser improvement, or to retry a
 * `failed` doc). The ingest job is idempotent — it replaces the document's chunks — so
 * re-enqueuing is safe. Policy-gated (OEM-staff update), tenant-scoped, audited.
 */
export async function reprocessDocument(ctx: ServiceContext, input: unknown): Promise<void> {
  const { documentId } = parseInput(ReprocessDocumentInput, input);
  ctx.policy.assertCan('update', 'Document');

  await ctx.withTenant(async (tx) => {
    const [doc] = await tx
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.tenantId, ctx.tenantId),
          eq(documents.id, documentId),
          readableDocument(ctx),
        ),
      )
      .for('update');
    if (!doc || doc.deletedAt) throw new NotFoundError('document');
    if (!doc.indexable)
      throw new ConflictError(
        'Reference-only files cannot be processed. Enable AI extraction in the draft first.',
      );
    if (doc.publication !== 'draft' || doc.publishedAt)
      throw new ConflictError('Create a new revision to reprocess published content.');
    if (doc.status === 'processing')
      throw new ConflictError(
        'This document is already processing. Stalled work is recovered automatically.',
      );
    await tx
      .update(documents)
      .set({
        status: 'uploaded',
        processingError: null,
        ingestionToken: null,
        updatedAt: new Date(Math.max(Date.now(), doc.updatedAt.getTime() + 1)),
      })
      .where(eq(documents.id, doc.id));
  });

  try {
    const producer = await getJobProducer(getEnv().PGBOSS_DATABASE_URL ?? getEnv().DATABASE_URL);
    await producer.enqueueIngestDocument({ tenantId: ctx.tenantId, documentId });
  } catch (error) {
    ctx.logger.error({ err: error, documentId }, 'retry saved; pending queue recovery');
  }

  ctx.auditor.record({
    kind: 'access',
    action: 'document.reprocess_requested',
    subjectType: 'Document',
    subjectId: documentId,
    decision: 'allow',
  });
  ctx.logger.info({ documentId }, 'document reprocess requested');
}
