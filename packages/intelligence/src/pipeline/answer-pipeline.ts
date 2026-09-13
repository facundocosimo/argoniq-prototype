import { z } from 'zod';
import {
  type AnswerMode,
  type ConfidenceBand,
  CompanyId,
  type KnowledgeTier,
  type PlaybookStep,
  type SafetyZone,
  SerialId,
  TenantId,
  canEmitProcedureRemotely,
  isCustomerCitable,
} from '@argoniq/core-domain';
import { ProvenanceToken, type RequesterScope, type Result, isErr } from '@argoniq/contracts';
import { isAppError } from '@argoniq/observability';
import {
  CauseCandidate,
  EvidenceFactor,
  type RankedCause,
  rankCauses,
} from '../diagnosis/rank-causes.js';
import {
  type DecideEscalationOptions,
  type EscalationDisposition,
  type EscalationReason,
  decideEscalation,
} from '../diagnosis/decide-escalation.js';
import { SymptomCandidate, normalizeSymptom } from '../symptom/normalize-symptom.js';
import { selectNextQuestion } from '../questioning/select-next-question.js';
import { SafetyContext, classifyZone, reconcileSuggestedZone } from '../safety/classify-zone.js';
import { HazardCue, reEscalateOnEvidence } from '../safety/re-escalate.js';
import {
  type CitationBinding,
  type CustomerClaim,
  type GroundingDowngrade,
  buildCustomerChannelContext,
  groundingGate,
} from '../governance/index.js';
import { assertOutputProvenance } from '../governance/assert-output-provenance.js';
import { type AnswerResult, type LlmPort, type ReasonResult } from '../llm/llm-port.js';

/**
 * Compose the intelligence layers into a customer-answer decision:
 *
 *   1. normalizeSymptom        — avoid mapping ambiguous wording
 *   2. classifyZone (+ reconcile + reEscalate)   — deterministic safety
 *   3. buildCustomerChannelContext               — exclude T3/T4 customer context
 *   4. assertOutputProvenance                    — block cross-scope output
 *   5. rankCauses → decideEscalation             — apply diagnostic policy
 *   6. groundingGate                             — every customer claim binds to a citation
 *   7. two-channel generation via LlmPort        — customer channel receives eligible context
 *
 * It is **pure** with respect to I/O: it performs retrieval-free reasoning over
 * inputs the *service* assembled (retrieved sources, resolved config, playbook
 * causes/steps) and reaches the model only through the injected `LlmPort`. That
 * keeps it unit-testable with `FakeLlm` and lets the eval harness call the same
 * function as the application service.
 *
 * Safety is asymmetric: every gate can only make the outcome more conservative.
 * A leak, an ungrounded claim, a RED zone, or a provenance mismatch
 * downgrades or hard-blocks — none can promote a weak answer to auto-send.
 */

// --- Input ------------------------------------------------------------------

/**
 * A retrieved knowledge source carrying BOTH its channel-eligibility fields (for
 * the structural gate 2) AND its provenance token (for the output-side gate 3).
 * The service builds these from the corpus; the eval builds them from fixtures.
 */
export const RetrievedSource = z.object({
  /** Stable handle the answer cites by (a chunk/source id). */
  ref: z.string().min(1),
  tier: z.custom<KnowledgeTier>(),
  /** Retrievable text for the generation context (customer channel sees T1/T2 only). */
  text: z.string().default(''),
  /** A hazard paragraph is excluded from customer context even at T1. */
  forbiddenForCustomerFacing: z.boolean().default(false),
  /** The provenance the source's citation would carry if emitted (gate 3). */
  provenance: ProvenanceToken,
  /** Display provenance for a rich, deep-linkable citation (chunk sources only). */
  documentTitle: z.string().optional(),
  sectionPath: z.string().optional(),
  sectionTitle: z.string().optional(),
});
export type RetrievedSource = z.infer<typeof RetrievedSource>;

/** The requester scope, validated through the branded id schemas. */
export const PipelineRequesterScope = z.object({
  tenantId: TenantId,
  companyId: CompanyId.optional(),
  serialId: SerialId.optional(),
});
export type PipelineRequesterScope = z.infer<typeof PipelineRequesterScope>;

/**
 * Whether the turn is an informational *lookup* ("where is the E42 procedure?")
 * or a *diagnostic* ("my parts are porous"). Lookups resolve on zone + grounding;
 * diagnostics additionally apply escalation policy to ranked causes.
 */
export const REQUEST_KINDS = ['lookup', 'diagnostic'] as const;
export const RequestKind = z.enum(REQUEST_KINDS);
export type RequestKind = z.infer<typeof RequestKind>;

export const AnswerPipelineInput = z.object({
  requestKind: RequestKind.default('lookup'),
  /** Raw operator wording — the LLM prompt + the audit trail's symptom text. */
  rawSymptom: z.string().default(''),
  /** Prior conversation turns (formatted) for follow-up continuity; '' for a fresh turn. */
  conversationContext: z.string().default(''),
  /** Scored ontology candidates from upstream classification (empty ⇒ unmapped). */
  symptomCandidates: z.array(SymptomCandidate).default([]),
  /** Plain-language EffectiveConfig summary for the generation context. */
  effectiveConfigSummary: z.string().default(''),
  /** Sources the retriever surfaced (BOTH channels; gate 2 splits them here). */
  sources: z.array(RetrievedSource).default([]),
  /** Candidate causes (playbook priors) for the diagnostic path. */
  candidateCauses: z.array(CauseCandidate).default([]),
  /** Soft-evidence factors gathered so far. */
  evidence: z.array(EvidenceFactor).default([]),
  /** Playbook steps for question selection + grounding-by-approved-step. */
  steps: z.array(z.custom<PlaybookStep>()).default([]),
  /** Step keys already asked, so the questioning layer never repeats one. */
  askedStepKeys: z.array(z.string()).default([]),
  /** Whether YELLOW preconditions are verified for THIS interaction (default-safe). */
  preconditionsVerified: z.boolean().default(false),
  /** Hazard cues detected in the latest answer/photo (monotonic re-escalation). */
  hazardCues: z.array(HazardCue).default([]),
  /** Deterministic safety context for the answer's required action (the zone basis). */
  safety: SafetyContext,
  /** Optional LLM zone suggestion; may only ever RAISE the rule zone. */
  suggestedZone: z.custom<SafetyZone>().optional(),
  /** Who is asking — the output-side isolation scope (gate 3). */
  requesterScope: PipelineRequesterScope,
  /** True when the requester is OEM staff (the internal channel may reason over T3). */
  staffRequester: z.boolean().default(false),
  /** True iff the backing playbook is PUBLISHED (an approved step is a valid citation). */
  playbookPublished: z.boolean().default(false),
  /**  side signals the confidence math cannot see (only ever escalate). */
  sourceConflict: z.boolean().default(false),
  configUncertain: z.boolean().default(false),
  openFleetCluster: z.boolean().default(false),
  /** The request itself asks for an unsafe action (bypass/override) ⇒ refuse (Mode F). */
  unsafeActionRequest: z.boolean().default(false),
});
export type AnswerPipelineInput = z.infer<typeof AnswerPipelineInput>;

// --- Output -----------------------------------------------------------------

/** A fact/citation physically present in the customer channel, with its provenance. */
export type EmittedFact = {
  readonly ref: string;
  readonly tier: KnowledgeTier;
  readonly provenance: z.infer<typeof ProvenanceToken>;
};

export type AnswerPipelineResult = {
  /** The normalized symptom key, or 'UNMAPPED'. */
  readonly symptomKey: string;
  readonly answerMode: AnswerMode;
  readonly safetyZone: SafetyZone;
  readonly confidence: ConfidenceBand;
  /** Best-first ranked causes (staff-facing; never shown to a customer as decimals). */
  readonly rankedCauses: readonly RankedCause[];
  readonly topScore: number;
  /** Whether a citable basis (T1/T2 source or approved step) backs the answer. */
  readonly grounded: boolean;
  /** Whether a step-by-step customer procedure was emitted (Mode A/B only). */
  readonly procedureEmitted: boolean;
  /** Facts/citations the customer channel carries (post gate-2 + gate-3). */
  readonly emittedFacts: readonly EmittedFact[];
  /** The next diagnostic question, when the case keeps diagnosing (Mode C). */
  readonly nextQuestion: PlaybookStep | null;
  /** Why the case escalated (audit trail), when it did. */
  readonly escalationReasons: readonly EscalationReason[];
  /** True iff gate 3 hard-blocked emission (a provenance/scope mismatch). */
  readonly blockedByProvenance: boolean;
  /** The grounding-gate downgrade, when a customer claim was unbound. */
  readonly groundingDowngrade: GroundingDowngrade | null;
  /** Customer-facing text (Mode A/B/C). Empty when nothing is emitted to the customer. */
  readonly customerText: string;
  /** Staff-facing reasoning (Mode D/E); may reflect T3. Never shown to a customer. */
  readonly internalNote: string | null;
};

// --- Generation instructions (the two channels) -----------------------------

const CUSTOMER_INSTRUCTIONS =
  'You are an OEM aftersales assistant answering a machine operator. Use ONLY the ' +
  'provided context; never invent part numbers, procedures, or values. Every technical ' +
  'claim must be supported by the context. Do not describe any step that touches stored ' +
  'energy, pressure, or live electrical systems — those are escalated separately. ' +
  'This may be a follow-up in an ongoing conversation: answer the latest message using ' +
  'the earlier turns for context, and do not repeat what you already said. ' +
  'Be concise and plain-language, and format the answer in GitHub-flavored Markdown — ' +
  '**bold** the key values, use bullet or numbered lists for multiple points or steps, ' +
  'and a Markdown table when you present a set of specifications.';

const INTERNAL_INSTRUCTIONS =
  'You are drafting a STAFF-FACING internal note for a support engineer. You may ' +
  'reason over internal (T3) context. State the ranked likely causes, the evidence, ' +
  'and the recommended next action. This note is never shown to the customer.';

// --- Helpers ----------------------------------------------------------------

/** Narrow the validated pipeline scope to the foundation `RequesterScope` (drops absent keys). */
function toRequesterScope(scope: PipelineRequesterScope): RequesterScope {
  return {
    tenantId: scope.tenantId,
    ...(scope.companyId !== undefined ? { companyId: scope.companyId } : {}),
    ...(scope.serialId !== undefined ? { serialId: scope.serialId } : {}),
  };
}

const CONFIDENCE_FALLBACK: Record<'high' | 'low', ConfidenceBand> = { high: 'HIGH', low: 'LOW' };

// --- The pipeline -----------------------------------------------------------

/**
 * Run the customer-answer pipeline. Pure w.r.t. I/O (the only side effect is the
 * injected `LlmPort`), deterministic given a deterministic `LlmPort`.
 */
export async function runAnswerPipeline(
  rawInput: z.input<typeof AnswerPipelineInput>,
  llm: LlmPort,
): Promise<AnswerPipelineResult> {
  const input = AnswerPipelineInput.parse(rawInput);
  const scope = toRequesterScope(input.requesterScope);

  // 1. Symptom normalization — never force a confident wrong map.
  const symptom = normalizeSymptom({ candidates: input.symptomCandidates });
  const symptomKey = symptom.kind === 'mapped' ? symptom.symptom.key : symptom.symptom;

  // 2. Deterministic safety zone (gate 1 basis). The LLM may only ever RAISE it,
  //    and any hazard cue monotonically re-escalates.
  const ruleZone = classifyZone(input.safety);
  const reconciled = reconcileSuggestedZone(ruleZone, input.suggestedZone ?? ruleZone);
  const safetyZone = reEscalateOnEvidence({ currentZone: reconciled, cues: input.hazardCues });

  // 3. GATE 2 (structural): build the customer channel by physically excluding
  //    T3/T4 and any chunk flagged forbidden-for-customer-facing.
  const customerChannel = buildCustomerChannelContext(
    input.sources.map((s) => ({
      sourceId: s.ref,
      tier: s.tier,
      text: s.text,
      forbiddenForCustomerFacing: s.forbiddenForCustomerFacing,
    })),
  );
  const companyRefs = new Set(customerChannel.map((s) => s.sourceId));
  const channelSources = input.sources.filter((s) => companyRefs.has(s.ref));

  // 4. GATE 3 (output-side isolation): assert every emitted citation matches the
  //    requester scope. On ANY mismatch the WHOLE output is hard-blocked
  //    (fail-closed, zero tolerance) — never a per-source silent drop.
  let emittedFacts: EmittedFact[] = channelSources.map((s) => ({
    ref: s.ref,
    tier: s.tier,
    provenance: s.provenance,
  }));
  let blockedByProvenance = false;
  try {
    assertOutputProvenance(
      emittedFacts.map((f) => ({ tokenId: f.ref, provenance: f.provenance })),
      scope,
    );
  } catch (error) {
    if (!isAppError(error)) throw error;
    blockedByProvenance = true;
    emittedFacts = [];
  }

  // 5. Grounding basis: a citable (T1/T2) in-scope fact, or an approved (published)
  //    playbook step. With no citable basis a customer technical claim cannot stand.
  const citableFacts = emittedFacts.filter((f) => isCustomerCitable(f.tier));
  const approvedStepKey =
    input.playbookPublished && input.steps.length > 0 ? input.steps[0]!.key : undefined;
  const sourceBacked = citableFacts.length > 0 || approvedStepKey !== undefined;

  // 6. Diagnostic ranking + the single  escalation gate (diagnostic turns only).
  const isDiagnostic = input.requestKind === 'diagnostic' && input.candidateCauses.length > 0;
  let disposition: EscalationDisposition | null = null;
  let rankedCauses: readonly RankedCause[] = [];
  let topScore = 0;
  if (isDiagnostic) {
    const posteriors = rankCauses({ candidates: input.candidateCauses, evidence: input.evidence });
    rankedCauses = posteriors.ranked;
    topScore = posteriors.topScore;
    const options: DecideEscalationOptions = {
      zone: safetyZone,
      sourceBacked,
      preconditionsVerified: input.preconditionsVerified,
      sourceConflict: input.sourceConflict,
      configUncertain: input.configUncertain,
      openFleetCluster: input.openFleetCluster,
      questionsAsked: input.askedStepKeys.length,
    };
    disposition = decideEscalation(posteriors, options);
  }

  // 7. Mode routing. Every branch is conservative by construction.
  let answerMode: AnswerMode;
  let confidence: ConfidenceBand;
  const escalationReasons: EscalationReason[] = [];

  if (blockedByProvenance) {
    // Gate 3 fired — nothing is source-backed once the leak is blocked.
    answerMode = 'E';
    confidence = CONFIDENCE_FALLBACK.low;
    escalationReasons.push('not_source_backed');
  } else if (safetyZone === 'RED') {
    // RED never carries a customer procedure. An explicit unsafe-action request is
    // refused (Mode F); any other RED case is a structured handoff (Mode E).
    answerMode = input.unsafeActionRequest ? 'F' : 'E';
    confidence = disposition?.confidence ?? CONFIDENCE_FALLBACK.low;
    escalationReasons.push('red_zone');
  } else if (disposition) {
    answerMode = disposition.answerMode;
    confidence = disposition.confidence;
    if (disposition.outcome === 'escalate') escalationReasons.push(...disposition.reasons);
  } else {
    // Lookup path: zone + grounding decide. GREEN ⇒ direct; verified YELLOW ⇒ guided.
    if (safetyZone === 'GREEN' && sourceBacked) {
      answerMode = 'A';
      confidence = CONFIDENCE_FALLBACK.high;
    } else if (safetyZone === 'YELLOW' && input.preconditionsVerified && sourceBacked) {
      answerMode = 'B';
      confidence = CONFIDENCE_FALLBACK.high;
    } else {
      answerMode = 'E';
      confidence = CONFIDENCE_FALLBACK.low;
      escalationReasons.push(sourceBacked ? 'unsafe_zone_for_autosend' : 'not_source_backed');
    }
  }

  // 8. Grounding gate — the last tripwire before a customer technical claim. Only
  //    runs when we still intend a customer-facing answer (A/B/C). An unbound claim
  //    downgrades: a hedged recommendation (C) or a structured case (E).
  let groundingDowngrade: GroundingDowngrade | null = null;
  if (answerMode === 'A' || answerMode === 'B' || answerMode === 'C') {
    const citations: CitationBinding[] = [
      ...citableFacts.map((f): CitationBinding => ({
        kind: 'source',
        sourceId: f.ref,
        tier: f.tier,
      })),
      ...(approvedStepKey !== undefined
        ? [{ kind: 'approvedPlaybookStep', stepKey: approvedStepKey } as CitationBinding]
        : []),
    ];
    const claim: CustomerClaim = { claimId: 'answer.core', isTechnical: true, citations };
    const gate: Result<readonly CustomerClaim[], GroundingDowngrade> = groundingGate([claim]);
    if (isErr(gate)) {
      groundingDowngrade = gate.error;
      answerMode = gate.error.downgradeTo;
      confidence = CONFIDENCE_FALLBACK.low;
      if (answerMode === 'E') escalationReasons.push('not_source_backed');
    }
  }

  // 9. Next question, when the case keeps diagnosing (Mode C recommendation).
  let nextQuestion: PlaybookStep | null = null;
  if (answerMode === 'C') {
    const selected = selectNextQuestion({
      steps: input.steps,
      rankedCauses: [...rankedCauses],
      askedStepKeys: input.askedStepKeys,
      preconditionsVerified: input.preconditionsVerified,
    });
    if (selected.kind === 'question') nextQuestion = selected.step;
  }

  let grounded = !blockedByProvenance && groundingDowngrade === null && sourceBacked;
  let procedureEmitted =
    (answerMode === 'A' || answerMode === 'B') &&
    grounded &&
    canEmitProcedureRemotely(safetyZone, input.preconditionsVerified);

  // 10. Two-channel generation. The customer channel sees ONLY the gate-2 context;
  //     the internal note (staff) may reason over the full set including T3.
  const wantsCustomerText = answerMode === 'A' || answerMode === 'B' || answerMode === 'C';
  let customerText = '';
  if (wantsCustomerText) {
    const prompt = input.conversationContext
      ? `${input.conversationContext}\n\nLatest message from the operator: ${input.rawSymptom}`
      : input.rawSymptom;
    const generationSources = customerChannel.filter((source) => source.text.length > 0);
    const result: AnswerResult = await llm.answer({
      instructions: CUSTOMER_INSTRUCTIONS,
      prompt,
      context: generationSources.map((source) => source.text),
    });
    customerText = result.text;
    if (result.sourceIndexes !== undefined) {
      const usedRefs = new Set(
        result.sourceIndexes.map((index) => generationSources[index]?.sourceId),
      );
      emittedFacts = emittedFacts.filter((fact) => usedRefs.has(fact.ref));
    }
    if (
      result.supported === false ||
      (result.sourceIndexes !== undefined && emittedFacts.length === 0)
    ) {
      grounded = false;
      procedureEmitted = false;
      confidence = 'LOW';
      answerMode = 'C';
    }
  }

  let internalNote: string | null = null;
  // Staff always get the internal reasoning note; an escalation (Mode E) carries a
  // staff-facing handoff note. Mode D (a standalone internal note) is not produced
  // by the customer-answer pipeline.
  const wantsInternalNote = input.staffRequester || answerMode === 'E';
  if (wantsInternalNote) {
    // The staff channel may reason over T3, but never T4: T4 is credential-isolated
    //  and the answer service must not read it. The retriever already excludes
    // T4 structurally (RLS + tier filter); this is the pipeline's defense-in-depth so
    // a T4 chunk can never enter a generation context even if upstream regressed.
    const result: ReasonResult = await llm.reason({
      instructions: INTERNAL_INSTRUCTIONS,
      prompt: `${input.rawSymptom}\n\nEffective config: ${input.effectiveConfigSummary}`,
      context: input.sources
        .filter((s) => s.tier !== 'T4')
        .map((s) => s.text)
        .filter((t) => t.length > 0),
    });
    internalNote = result.text;
  }

  return {
    symptomKey,
    answerMode,
    safetyZone,
    confidence,
    rankedCauses,
    topScore,
    grounded,
    procedureEmitted,
    emittedFacts,
    nextQuestion,
    escalationReasons,
    blockedByProvenance,
    groundingDowngrade,
    customerText,
    internalNote,
  };
}
