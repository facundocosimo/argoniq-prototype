import { eq } from 'drizzle-orm';
import { CaseGetInput } from '@argoniq/core-domain';
import { cases, companies, serials, sites, caseAttachments, caseDeliveries } from '@argoniq/db';
import { NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { attachmentView } from './attachments.js';
import { toCaseView } from './list-cases.js';

/** Explicit public projection; internal notes and AI reasoning never enter this DTO. */
export async function getCase(ctx: ServiceContext, input: unknown) {
  const { caseId } = parseInput(CaseGetInput, input);
  ctx.policy.assertCan('read', 'Case');
  return ctx.withTenant(async (tx) => {
    const [row] = await tx.select().from(cases).where(eq(cases.id, caseId)).limit(1);
    if (!row) throw new NotFoundError('case', caseId);
    ctx.policy.assertCan('read', 'Case', { id: row.id, companyId: row.companyId });
    const [company] = await tx
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, row.companyId))
      .limit(1);
    const [site] = await tx
      .select({ name: sites.name })
      .from(sites)
      .where(eq(sites.id, row.siteId))
      .limit(1);
    const machine = row.serialId
      ? (
          await tx
            .select({ id: serials.id, serialNumber: serials.serialNumber })
            .from(serials)
            .where(eq(serials.id, row.serialId))
            .limit(1)
        )[0]
      : null;
    const attachments = (
      await tx.select().from(caseAttachments).where(eq(caseAttachments.caseId, row.id))
    ).map(attachmentView);
    const [delivery] = await tx
      .select({
        status: caseDeliveries.status,
        sentAt: caseDeliveries.sentAt,
        externalId: caseDeliveries.externalId,
        error: caseDeliveries.error,
      })
      .from(caseDeliveries)
      .where(eq(caseDeliveries.caseId, row.id));
    return {
      ...toCaseView(row),
      report: row.report,
      destination: row.destination,
      attachments,
      delivery: delivery ?? null,
      machine: machine ?? null,
      companyName: company?.name ?? null,
      siteName: site?.name ?? null,
    };
  });
}
