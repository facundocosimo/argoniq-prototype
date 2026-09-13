import { and, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { KNOWLEDGE_TIERS, roleCanSeeTier, roleSpaceOf } from '@argoniq/core-domain';
import { documents } from '@argoniq/db';
import type { ServiceContext } from '../../context.js';

/** One predicate for primary and additional targets, always ANDed with ownership.
 * Read the actual serial relationship, including installation, in the same query. */
export function documentMachineEligibility(
  tenantId: string,
  serialId?: string | SQL,
  companyId?: string,
): SQL {
  return sql`exists (select 1 from serials eligible_machine
    where eligible_machine.tenant_id = ${tenantId}
    ${serialId ? sql`and eligible_machine.id = ${serialId}::uuid` : sql``}
    ${companyId ? sql`and eligible_machine.company_id = ${companyId}::uuid` : sql``}
    and (${documents.companyId} is null or ${documents.companyId} = eligible_machine.company_id)
    and (${documents.serialId} is null or ${documents.serialId} = eligible_machine.id)
    and (${documents.installationId} is null or ${documents.installationId} = eligible_machine.installation_id)
    and (
      ((${documents.familyId} is null or ${documents.familyId} = eligible_machine.family_id)
        and (${documents.modelId} is null or ${documents.modelId} = eligible_machine.model_id))
      or exists (select 1 from document_scopes target
        where target.tenant_id = ${tenantId} and target.document_id = ${documents.id}
        and ((target.scope_type = 'family' and target.family_id = eligible_machine.family_id)
          or (target.scope_type = 'model' and target.model_id = eligible_machine.model_id)))
    ))`;
}

/** Scheduled editions take effect without retiring the previous edition early.
 * Publication is serialized by group; effective date then revision breaks ties. */
export function effectiveDocument(): SQL {
  return sql`${documents.publication} = 'approved' and ${documents.deletedAt} is null
    and ${documents.effectiveFrom} <= now()
    and not exists (select 1 from documents newer
      where newer.tenant_id = ${documents.tenantId} and newer.revision_group_id = ${documents.revisionGroupId}
      and newer.publication = 'approved' and newer.deleted_at is null and newer.effective_from <= now()
      and (newer.effective_from, newer.revision_number) > (${documents.effectiveFrom}, ${documents.revisionNumber}))`;
}

export function readableDocument(
  ctx: ServiceContext,
  options: { serialId?: string; historical?: boolean } = {},
): SQL {
  const customer = roleSpaceOf(ctx.actor.role) === 'customer';
  const conditions = [eq(documents.tenantId, ctx.tenantId), isNull(documents.deletedAt)];
  if (customer) {
    if (!ctx.actor.companyId) return sql`false`;
    conditions.push(inArray(documents.tier, ['T1', 'T2']));
    conditions.push(or(eq(documents.tier, 'T1'), eq(documents.companyId, ctx.actor.companyId))!);
    conditions.push(
      documentMachineEligibility(ctx.tenantId, options.serialId, ctx.actor.companyId),
    );
    conditions.push(
      options.historical
        ? sql`${documents.publication} = 'approved' and ${documents.effectiveFrom} <= now()`
        : effectiveDocument(),
    );
  } else {
    conditions.push(
      inArray(
        documents.tier,
        KNOWLEDGE_TIERS.filter((tier) => roleCanSeeTier(ctx.actor.role, tier)),
      ),
    );
    if (options.serialId)
      conditions.push(
        documentMachineEligibility(ctx.tenantId, options.serialId),
        effectiveDocument(),
      );
  }
  return and(...conditions)!;
}
