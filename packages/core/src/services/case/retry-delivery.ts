import { and, eq } from 'drizzle-orm';
import { CaseGetInput } from '@argoniq/core-domain';
import { cases, caseDeliveries } from '@argoniq/db';
import { ConflictError, NotFoundError } from '@argoniq/observability';
import { publicDestination, resolveSupportRoute } from '@argoniq/notifications/support';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
export async function retryCaseDelivery(ctx: ServiceContext, input: unknown) {
  const { caseId } = parseInput(CaseGetInput, input);
  ctx.policy.assertCan('update', 'Case');
  return ctx.withTenant(async (tx) => {
    const [record] = await tx.select().from(cases).where(eq(cases.id, caseId));
    if (!record) throw new NotFoundError('case');
    ctx.policy.assertCan('update', 'Case', { id: record.id, companyId: record.companyId });
    if (
      publicDestination(resolveSupportRoute(ctx.tenantId, record.companyId)).version !==
      record.destination?.version
    )
      throw new ConflictError('Restore the original support destination before retrying.');
    const [delivery] = await tx
      .select()
      .from(caseDeliveries)
      .where(eq(caseDeliveries.caseId, caseId))
      .for('update');
    if (delivery?.status !== 'failed')
      throw new ConflictError(
        'Only a failed delivery can be retried. Verify uncertain deliveries with the provider before any new send.',
      );
    if (
      record.destination.channel === 'email' &&
      Date.now() - delivery.createdAt.getTime() > 23 * 60 * 60_000
    )
      throw new ConflictError(
        'The email retry window expired. Check the provider before resending.',
      );
    await tx
      .update(caseDeliveries)
      .set({ status: 'pending', nextAttemptAt: new Date(), error: null, updatedAt: new Date() })
      .where(and(eq(caseDeliveries.id, delivery.id), eq(caseDeliveries.status, 'failed')));
    ctx.auditor.record({
      kind: 'access',
      action: 'case.delivery.retry',
      subjectType: 'Case',
      subjectId: caseId,
      decision: 'allow',
    });
    return { queued: true };
  });
}
