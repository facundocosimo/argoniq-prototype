import { createHash } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { CaseCreateInput, MAX_CASE_TOTAL_BYTES } from '@argoniq/core-domain';
import { cases, caseAttachments, caseDeliveries, companies, sites } from '@argoniq/db';
import { ConflictError, ValidationError } from '@argoniq/observability';
import { publicDestination, resolveSupportRoute } from '@argoniq/notifications/support';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { supportSources } from './prepare-draft.js';
import { authorizedCaseMachine, lockCaseDraft } from './attachments.js';

/** Explicit human confirmation; case, evidence ownership and delivery outbox commit together. */
export async function createCase(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: string; reference: string }> {
  const data = parseInput(CaseCreateInput, input);
  ctx.policy.assertCan('create', 'Case');
  const attachmentIds = [...new Set(data.attachmentIds)].sort();
  const hash = createHash('sha256')
    .update(JSON.stringify({ ...data, attachmentIds }))
    .digest('hex');
  const row = await ctx.withTenant(async (tx) => {
    const machine = await authorizedCaseMachine(ctx, tx, data.serialId);
    await lockCaseDraft(tx, ctx.tenantId, data.submissionKey);
    const [existing] = await tx
      .select()
      .from(cases)
      .where(eq(cases.submissionKey, data.submissionKey));
    if (existing) {
      if (existing.submittedBy !== ctx.actor.userId || existing.submissionHash !== hash)
        throw new ConflictError(
          'This request was already submitted with different details. Open your support requests to review it.',
        );
      return existing;
    }
    const destination = publicDestination(resolveSupportRoute(ctx.tenantId, machine.companyId));
    if (destination.version !== data.destinationVersion)
      throw new ConflictError(
        'The support destination changed. Refresh the page and review the destination before submitting.',
      );
    const files = attachmentIds.length
      ? await tx
          .select()
          .from(caseAttachments)
          .where(
            and(
              inArray(caseAttachments.id, attachmentIds),
              eq(caseAttachments.submissionKey, data.submissionKey),
              eq(caseAttachments.serialId, machine.id),
              eq(caseAttachments.uploadedBy, ctx.actor.userId),
              isNull(caseAttachments.caseId),
            ),
          )
      : [];
    if (files.length !== attachmentIds.length)
      throw new ValidationError(
        'An attachment is unavailable. Review your files before submitting.',
      );
    if (files.reduce((sum, f) => sum + f.size, 0) > MAX_CASE_TOTAL_BYTES)
      throw new ValidationError('Attachments exceed the 20 MB total limit.');
    const sourceReferences = await supportSources(
      ctx,
      tx,
      machine.id,
      machine.companyId,
      data.report.sourceReferences ?? [],
    );
    if (sourceReferences.length !== (data.report.sourceReferences ?? []).length)
      throw new ValidationError(
        'A source is no longer available for this machine. Remove it from the report or prepare the draft again.',
      );
    const [created] = await tx
      .insert(cases)
      .values({
        tenantId: ctx.tenantId,
        companyId: machine.companyId,
        siteId: machine.siteId,
        serialId: machine.id,
        summary: data.summary,
        status: 'open',
        aiAssisted: data.report.preparedFromChat === true,
        report: { ...data.report, sourceReferences },
        destination,
        submissionKey: data.submissionKey,
        submissionHash: hash,
        submittedBy: ctx.actor.userId,
      })
      .returning();
    if (attachmentIds.length)
      await tx
        .update(caseAttachments)
        .set({ caseId: created!.id })
        .where(inArray(caseAttachments.id, attachmentIds));
    const [company] = await tx
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, machine.companyId));
    const [site] = await tx
      .select({ name: sites.name })
      .from(sites)
      .where(eq(sites.id, machine.siteId));
    await tx.insert(caseDeliveries).values({
      machineContext: {
        serialNumber: machine.serialNumber,
        companyName: company!.name,
        siteName: site!.name,
      },
      tenantId: ctx.tenantId,
      caseId: created!.id,
      status: destination.channel === 'inbox' ? 'sent' : 'pending',
      sentAt: destination.channel === 'inbox' ? new Date() : null,
    });
    return created!;
  });
  ctx.auditor.record({
    kind: 'access',
    action: 'case.created',
    subjectType: 'Case',
    subjectId: row.id,
    decision: 'allow',
  });
  return { id: row.id, reference: `CASE-${row.id.slice(0, 8).toUpperCase()}` };
}
