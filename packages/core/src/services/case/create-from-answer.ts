import {
  type AnswerMode,
  type ConfidenceBand,
  type SafetyZone,
  type SymptomId,
  CaseId,
  classifyConfidence,
} from '@argoniq/core-domain';
import { type RankedCause } from '@argoniq/intelligence';
import { cases } from '@argoniq/db';
import { InternalError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';

/**
 * Persist an escalation as a support case. `summary` is customer-facing;
 * `internalNote` and numeric cause rankings are staff-facing. Authorization and
 * tenant-scoped database access are applied before the insert.
 */
export type CreateCaseFromAnswerParams = {
  readonly companyId: string;
  readonly siteId: string;
  readonly serialId: string;
  readonly symptomId: SymptomId;
  /** Customer-facing plain-language summary (never reflects T3). */
  readonly summary: string;
  /** Staff-facing reasoning; may reflect T3. Never shown to a customer. */
  readonly internalNote: string | null;
  readonly rankedCauses: readonly RankedCause[];
  readonly causeLabels: ReadonlyMap<string, string>;
  readonly suggestedPartIds: readonly string[];
  readonly answerMode: AnswerMode;
  readonly safetyZone: SafetyZone;
  readonly confidence: ConfidenceBand;
};

export async function createCaseFromAnswer(
  ctx: ServiceContext,
  params: CreateCaseFromAnswerParams,
): Promise<CaseId> {
  ctx.policy.assertCan('create', 'Case', { companyId: params.companyId });

  // Staff-facing ranked causes carry the numeric posterior; the band is
  // derived for any customer-visible rendering. Eliminated causes are dropped.
  const rankedCauses = params.rankedCauses
    .filter((cause) => !cause.eliminated)
    .map((cause) => ({
      key: cause.key,
      label: params.causeLabels.get(cause.key) ?? cause.key,
      confidence: cause.posterior,
      rationale: classifyConfidence(cause.posterior),
    }));

  const id = await ctx.withTenant(async (tx) => {
    const [row] = await tx
      .insert(cases)
      .values({
        tenantId: ctx.tenantId,
        companyId: params.companyId,
        siteId: params.siteId,
        serialId: params.serialId,
        symptomId: params.symptomId,
        status: 'open',
        summary: params.summary,
        internalNote: params.internalNote,
        rankedCauses,
        suggestedPartIds: [...params.suggestedPartIds],
        answerMode: params.answerMode,
        safetyZone: params.safetyZone,
        confidence: params.confidence,
        aiAssisted: true,
      })
      .returning({ id: cases.id });
    return row?.id;
  });

  if (!id) throw new InternalError('case insert returned no id');

  ctx.logger.info(
    {
      caseId: id,
      serialId: params.serialId,
      answerMode: params.answerMode,
      zone: params.safetyZone,
    },
    'escalation case created from answer',
  );
  return CaseId.parse(id);
}
