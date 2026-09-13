import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  ANSWER_MODE_LABELS,
  type AnswerMode,
  CONFIDENCE_BAND_LABELS,
  CanonicalSymptom,
  type ConfidenceBand,
  CompanyId,
  type SafetyZone,
  SAFETY_ZONE_LABELS,
  SerialId,
  SymptomId,
  type TenantId,
  classifyConfidence,
  isCustomerCitable,
  roleSpaceOf,
} from '@argoniq/core-domain';
import {
  EvidenceFactor,
  FakeEmbeddings,
  FakeLlm,
  type LlmPort,
  type RetrievedSource,
  normalizeSymptom,
  planConversation,
  rankCauses,
  runAnswerPipeline,
  scoreSymptom,
  selectNextQuestion,
} from '@argoniq/intelligence';
import {
  machineModels,
  machineFamilies,
  playbooks,
  type PlaybookRow,
  serials,
  type SymptomRow,
  symptoms,
  variantAxes,
} from '@argoniq/db';
import { InternalError, NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { buildEffectiveConfig } from '../machine/effective-config.js';
import { type RetrievalDeps, DrizzleChunkSearch, buildKnowledgeSources } from './retrieval.js';

/**
 * Customer-answer service. It validates the request, checks access, loads the
 * selected machine configuration and playbook, retrieves permitted sources, runs
 * `runAnswerPipeline`, and records the decision. The tRPC router calls this
 * service. Chat does not submit a support request; the customer reviews and sends
 * it through the case service.
 *
 * The language model is injected and defaults to `FakeLlm`; a live adapter must
 * be selected explicitly by the caller.
 */

export const AnswerSymptomInput = z.object({
  serialId: SerialId,
  /** Free-text operator wording (primary). Lexically mapped to the  ontology. */
  symptomText: z.string().trim().min(1).max(2000),
  /** A confirmed symptom — set when the customer picks a clarify candidate. */
  symptomId: SymptomId.optional(),
  /** Prior conversation turns for follow-up continuity (oldest→newest, capped). */
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(4000) }))
    .max(20)
    .default([]),
  /** Soft-evidence factors gathered across the diagnostic loop. */
  evidence: z.array(EvidenceFactor).default([]),
  /** Step keys already asked, so the questioning layer never repeats one. */
  askedStepKeys: z.array(z.string()).default([]),
  /** Whether YELLOW preconditions are verified for this interaction (default-safe). */
  preconditionsVerified: z.boolean().default(false),
});
export type AnswerSymptomInput = z.infer<typeof AnswerSymptomInput>;

/** A customer-safe citation (T1/T2 only, gate-enforced) surfaced with the answer. */
export type AnswerCitation = {
  readonly ref: string;
  readonly tier: 'T1' | 'T2';
  readonly documentId?: string;
  readonly page?: number;
  /** Display provenance for a deep-linkable citation ("Training Reference, p.4"). */
  readonly title?: string;
  readonly sectionPath?: string;
  readonly sectionTitle?: string;
};

/** A ranked cause rendered for display — bands only, never a raw decimal. */
export type AnswerCause = {
  readonly key: string;
  readonly label: string;
  readonly confidence: ConfidenceBand;
};

/** A clarify candidate when free text could not be confidently mapped. */
export type ClarifyOption = {
  readonly symptomId: string;
  readonly label: string;
};

/**
 * The view the service returns to a transport. It is assembled to be safe for the
 * requester: staff-only content (`internalNote`, escalation reasons, full cause
 * ranking on an escalation) is present only when the requester is OEM staff.
 */
export type AnswerView = {
  readonly answerMode: AnswerMode;
  readonly answerModeLabel: string;
  readonly safetyZone: SafetyZone;
  readonly safetyZoneLabel: string;
  readonly confidence: ConfidenceBand;
  readonly confidenceLabel: string;
  readonly customerMessage: string;
  readonly grounded: boolean;
  readonly citations: readonly AnswerCitation[];
  readonly rankedCauses: readonly AnswerCause[] | null;
  readonly nextQuestion: { readonly key: string; readonly text: string } | null;
  readonly caseId: string | null;
  /** Staff-only: the internal reasoning note (may reflect T3). */
  readonly internalNote: string | null;
  /** Staff-only: why the case escalated. */
  readonly escalationReasons: readonly string[];
  /** Conversational reply or clarification; render without technical evidence/safety badges. */
  readonly needsClarification: boolean;
  readonly clarifyOptions: readonly ClarifyOption[];
};

export type AnswerSymptomDeps = RetrievalDeps & {
  readonly llm: LlmPort;
};

/** Energy/hazard wording forces a RED pre-screen; an explicit defeat ⇒ refuse (F). */
const ENERGY_PATTERN =
  /\b(bypass|interlock|lockout|loto|pressuri[sz]|accumulator|energ|electric|live|capacitor|hot\s|suspended|spring|moving part|guard removal)\b/i;
const UNSAFE_ACTION_PATTERN = /\b(bypass|override|defeat|disable)\b/i;

/** A safe escalation message — generic by design, never leaking the unsafe detail. */
const ESCALATION_SUMMARY =
  'I can’t determine the cause from the information available here. You can contact OEM support to review the problem.';
const REFUSAL_SUMMARY =
  'This action involves stored energy or a safety system and cannot be guided over chat. Contact a qualified OEM technician for help.';

/** Prefer the published playbook; otherwise the highest-version draft (authoring stage). */
function pickPlaybook(rows: PlaybookRow[]): PlaybookRow | null {
  if (rows.length === 0) return null;
  const published = rows.filter((r) => r.status === 'published');
  const pool = published.length > 0 ? published : rows;
  return pool.reduce((best, row) => (row.version > best.version ? row : best));
}

type SymptomResolution =
  | { readonly kind: 'mapped'; readonly symptom: SymptomRow }
  | { readonly kind: 'clarify'; readonly options: ClarifyOption[] }
  | { readonly kind: 'none' };

/**
 * Resolve the operator's wording to a canonical symptom. An explicit
 * `symptomId` (a confirmed clarify choice) is honored directly; otherwise the
 * deterministic lexical scorer ranks the family's active ontology and
 * `normalizeSymptom` applies the never-over-map rule. Ambiguity returns ranked
 * `clarify` options rather than a forced (possibly wrong) diagnosis.
 */
function resolveSymptom(
  text: string,
  symptomId: string | undefined,
  active: SymptomRow[],
): SymptomResolution {
  if (symptomId) {
    const found = active.find((s) => s.id === symptomId);
    return found ? { kind: 'mapped', symptom: found } : { kind: 'none' };
  }
  if (active.length === 0) return { kind: 'none' };

  const candidates = active.map((s) => ({
    symptom: CanonicalSymptom.parse(s),
    score: scoreSymptom(text, s),
  }));
  const norm = normalizeSymptom({ candidates });
  if (norm.kind === 'mapped') {
    const found = active.find((s) => s.id === norm.symptom.id);
    return found ? { kind: 'mapped', symptom: found } : { kind: 'none' };
  }

  // Offer only candidates with actual lexical evidence; unrelated ontology is not clarification.
  const scored = norm.candidates.filter((c) => c.score > 0);
  const pool = scored;
  const options = pool
    .slice(0, 6)
    .map((c) => ({ symptomId: c.symptom.id, label: c.symptom.label }));
  return options.length > 0 ? { kind: 'clarify', options } : { kind: 'none' };
}

const CLARIFY_MESSAGE = "A few things could cause this — which best matches what you're seeing?";

/** The view for an unmapped symptom: a GREEN, no-serviceCase prompt with ranked options. */
function clarifyView(options: readonly ClarifyOption[], message = CLARIFY_MESSAGE): AnswerView {
  return {
    answerMode: 'C',
    answerModeLabel: ANSWER_MODE_LABELS.C,
    safetyZone: 'GREEN',
    safetyZoneLabel: SAFETY_ZONE_LABELS.GREEN,
    confidence: 'LOW',
    confidenceLabel: CONFIDENCE_BAND_LABELS.LOW,
    customerMessage: message,
    grounded: false,
    citations: [],
    rankedCauses: null,
    nextQuestion: null,
    caseId: null,
    internalNote: null,
    escalationReasons: [],
    needsClarification: true,
    clarifyOptions: options,
  };
}

export async function answerSymptom(
  ctx: ServiceContext,
  input: unknown,
  deps: AnswerSymptomDeps = {
    llm: new FakeLlm(),
    embeddings: new FakeEmbeddings(),
    search: new DrizzleChunkSearch(),
    retrievalMode: 'lexical',
  },
): Promise<AnswerView> {
  const parsed = parseInput(AnswerSymptomInput, input);
  ctx.policy.assertCan('read', 'Serial');

  // Follow-up continuity: a compact transcript for the LLM, and a retrieval query that
  // folds in the recent user turns so a vague follow-up ("and the exact pressure?")
  // still retrieves the right chunks.
  const conversationContext = formatConversation(parsed.history);
  const retrievalQuery = withRecentContext(parsed.history, parsed.symptomText);

  const serial = await ctx.withTenant(async (tx) => {
    const [row] = await tx.select().from(serials).where(eq(serials.id, parsed.serialId)).limit(1);
    return row;
  });
  if (!serial) throw new NotFoundError('serial', parsed.serialId);
  ctx.policy.assertCan('read', 'Serial', { id: serial.id, companyId: serial.companyId });

  const explicitUnsafe =
    ENERGY_PATTERN.test(parsed.symptomText) && UNSAFE_ACTION_PATTERN.test(parsed.symptomText);
  // An explicit unsafe action does not need retrieval or model approval to be refused.
  if (explicitUnsafe) {
    return warmHandoff(ctx, {
      requestText: parsed.symptomText,
      staffRequester: roleSpaceOf(ctx.actor.role) === 'oem_staff',
      symptom: null,
      intent: 'problem',
      scope: {
        tenantId: ctx.tenantId,
        companyId: CompanyId.parse(serial.companyId),
        serialId: SerialId.parse(serial.id),
      },
    });
  }
  const machine = await ctx.withTenant(async (tx) => {
    const [model] = await tx
      .select({ name: machineModels.name })
      .from(machineModels)
      .where(eq(machineModels.id, serial.modelId))
      .limit(1);
    const [family] = await tx
      .select({ name: machineFamilies.name })
      .from(machineFamilies)
      .where(eq(machineFamilies.id, serial.familyId))
      .limit(1);
    return {
      model: model?.name ?? null,
      family: family?.name ?? null,
      serialNumber: serial.serialNumber,
    };
  });
  const conversation = { message: parsed.symptomText, history: parsed.history.slice(-8), machine };
  const decision = await planConversation(deps.llm, conversation);
  const intent = decision.intent;
  const conversationalReply = (message: string, offerSupport = false): AnswerView => {
    ctx.auditor.record({
      kind: 'ai_decision',
      action: 'ai.answer',
      symptomKey: `intent:${intent}`,
      serialId: parsed.serialId,
      answerMode: offerSupport ? 'E' : 'C',
      safetyZone: 'GREEN',
      confidence: 'LOW',
      sources: [],
      escalated: false,
    });
    return {
      ...clarifyView([], message),
      ...(offerSupport ? { answerMode: 'E' as const, answerModeLabel: ANSWER_MODE_LABELS.E } : {}),
    };
  };
  if (decision.action !== 'retrieve')
    return conversationalReply(decision.message, decision.action === 'support');

  const loaded = await ctx.withTenant(async (tx) => {
    const axes = await tx.select().from(variantAxes).where(eq(variantAxes.modelId, serial.modelId));
    const config = buildEffectiveConfig(serial, axes);

    // Resolve the symptom: a confirmed id, else lexically map the free text onto the
    // family's active ontology (never over-map — ambiguity routes to clarify).
    const active = await tx
      .select()
      .from(symptoms)
      .where(and(eq(symptoms.familyId, serial.familyId), eq(symptoms.status, 'active')));
    const resolution = resolveSymptom(parsed.symptomText, parsed.symptomId, active);
    const symptom = resolution.kind === 'mapped' ? resolution.symptom : null;

    const playbookRows = symptom
      ? await tx
          .select()
          .from(playbooks)
          .where(and(eq(playbooks.familyId, serial.familyId), eq(playbooks.symptomId, symptom.id)))
      : [];
    const playbook = pickPlaybook(playbookRows);

    // Retrieve only after the message contains enough detail. Manuals remain useful
    // even when this OEM has not authored a matching diagnostic playbook.
    const sources = await buildKnowledgeSources(
      tx,
      {
        tenantId: ctx.tenantId,
        companyId: CompanyId.parse(serial.companyId),
        serialId: SerialId.parse(serial.id),
        serialNumber: serial.serialNumber,
        familyId: serial.familyId,
        modelId: serial.modelId,
        config,
        queryText: retrievalQuery,
      },
      deps,
    );
    return { serial, config, resolution, symptom, playbook, sources };
  });

  const { symptom, config, playbook, sources } = loaded;
  const staffRequester = roleSpaceOf(ctx.actor.role) === 'oem_staff';
  const requestText = parsed.symptomText;
  const scope = {
    tenantId: ctx.tenantId,
    companyId: CompanyId.parse(serial.companyId),
    serialId: SerialId.parse(serial.id),
  };
  const causeLabels = new Map((playbook?.candidateCauses ?? []).map((c) => [c.key, c.label]));

  // Guided Resolution routing : classify the request intent internally, then
  // route. A grounded QUESTION/PARAMETER is answered directly and cited (Mode A); a
  // PROBLEM with a playbook follows the diagnostic pipeline. Without supporting
  // evidence, continue the conversation instead of manufacturing a diagnosis or case.
  const canDiagnose = symptom !== null && playbook !== null && playbook.candidateCauses.length > 0;
  const hasGroundedDoc = sources.some(
    (s) => s.ref.startsWith('chunk:') && isCustomerCitable(s.tier),
  );
  const informationalPreferred = intent === 'question' || intent === 'parameter';
  const informationalArgs = {
    serial,
    symptom,
    config,
    sources,
    requestText,
    conversationContext,
    staffRequester,
    scope,
    intent,
    deps,
  };

  // 1. An explicit question/parameter the corpus can answer → answer it, cited.
  if (informationalPreferred && hasGroundedDoc) {
    return answerInformational(ctx, informationalArgs);
  }
  // 2. A missing playbook does not imply a fault severity or require a case. Try
  //    applicable document evidence, then clarification or an honest support offer.
  if (!canDiagnose) {
    if (hasGroundedDoc) return answerInformational(ctx, informationalArgs);
    if (loaded.resolution.kind === 'clarify') return clarifyView(loaded.resolution.options);
    const followUp = await planConversation(deps.llm, conversation, 'no_evidence');
    return conversationalReply(followUp.message, followUp.action === 'support');
  }
  // 3. Diagnostic spine — symptom + playbook are non-null here (canDiagnose).
  if (!symptom || !playbook) throw new InternalError('diagnostic invariant: symptom+playbook');

  const candidateCauses = playbook.candidateCauses.map((c) => ({
    key: c.key,
    prior: c.priorScore,
    eliminated: false,
  }));

  // Derive the answer's safety context (the zone basis, gate 1) from the recommended
  // next step — the deterministic rule decides, never the model. A request that
  // explicitly names an energy hazard / defeat is screened straight to RED/refuse.
  const prelim = rankCauses({ candidates: candidateCauses, evidence: parsed.evidence });
  const safeStep = selectNextQuestion({
    steps: playbook.steps,
    rankedCauses: [...prelim.ranked],
    askedStepKeys: parsed.askedStepKeys,
    preconditionsVerified: parsed.preconditionsVerified,
  });
  const { safety, unsafeActionRequest } = deriveSafety(requestText, safeStep);

  const result = await runAnswerPipeline(
    {
      requestKind: 'diagnostic',
      rawSymptom: requestText,
      conversationContext,
      effectiveConfigSummary: summarizeConfig(config),
      sources,
      candidateCauses,
      evidence: parsed.evidence,
      steps: playbook.steps,
      askedStepKeys: parsed.askedStepKeys,
      preconditionsVerified: parsed.preconditionsVerified,
      safety,
      requesterScope: scope,
      staffRequester,
      playbookPublished: playbook.status === 'published',
      configUncertain: config.overallConfidence === 'LOW',
      unsafeActionRequest,
    },
    deps.llm,
  );

  // Audit: every safety determination and AI decision is reconstructable.
  ctx.auditor.record({
    kind: 'safety',
    action: 'safety.decision',
    zone: result.safetyZone,
    rule: 'classifyZone',
    outcome:
      result.answerMode === 'F'
        ? 'refuse'
        : result.escalationReasons.length > 0
          ? 'escalate'
          : 'allow',
  });
  ctx.auditor.record({
    kind: 'ai_decision',
    action: 'ai.answer',
    symptomKey: symptom.key,
    serialId: scope.serialId,
    answerMode: result.answerMode,
    safetyZone: result.safetyZone,
    confidence: result.confidence,
    sources: result.emittedFacts.map((f) => ({
      ...(f.provenance.documentId ? { documentId: f.provenance.documentId } : {}),
      tier: f.tier,
      ...(f.provenance.page ? { page: f.provenance.page } : {}),
    })),
    escalated: result.escalationReasons.length > 0,
  });

  // Escalation is advice, not consent to create a case. Submission has its own service.
  return toView(result, {
    staffRequester,
    causeLabels,
    caseId: null,
    sources,
    customerMessage:
      result.answerMode === 'F'
        ? REFUSAL_SUMMARY
        : result.answerMode === 'E'
          ? ESCALATION_SUMMARY
          : result.customerText.trim() || composeFallbackMessage(result, causeLabels),
  });
}

type Intent = 'problem' | 'parameter' | 'question';

/** Safety context for an informational answer: energy wording pre-screens to RED,
 *  otherwise it is an approved informational lookup (GREEN). The rule still decides. */
function deriveInformationalSafety(requestText: string): {
  safety: Parameters<typeof runAnswerPipeline>[0]['safety'];
  unsafeActionRequest: boolean;
} {
  if (ENERGY_PATTERN.test(requestText)) {
    return {
      safety: { safetyInterlock: true },
      unsafeActionRequest: UNSAFE_ACTION_PATTERN.test(requestText),
    };
  }
  return { safety: { approvedInformationalLookup: true }, unsafeActionRequest: false };
}

type InformationalArgs = {
  serial: { id: string; companyId: string; siteId: string; serialNumber: string };
  symptom: SymptomRow | null;
  config: ReturnType<typeof buildEffectiveConfig>;
  sources: RetrievedSource[];
  requestText: string;
  conversationContext: string;
  staffRequester: boolean;
  scope: { tenantId: TenantId; companyId: CompanyId; serialId: SerialId };
  intent: Intent;
  deps: AnswerSymptomDeps;
};

/** Format prior turns as a compact transcript for the LLM (bounded to the last 8). */
function formatConversation(
  history: readonly { role: 'user' | 'assistant'; text: string }[],
): string {
  if (history.length === 0) return '';
  return history
    .slice(-8)
    .map((t) => `${t.role === 'user' ? 'Operator' : 'Assistant'}: ${t.text}`)
    .join('\n');
}

/** Fold the recent user turns into the retrieval query so vague follow-ups still ground. */
function withRecentContext(
  history: readonly { role: 'user' | 'assistant'; text: string }[],
  current: string,
): string {
  const recentUser = history
    .filter((t) => t.role === 'user')
    .slice(-2)
    .map((t) => t.text);
  return [...recentUser, current].join(' ').slice(0, 1000);
}

/**
 * The informational-answer path (Guided Resolution). Runs the
 * same pipeline as diagnosis but in `lookup` mode: GREEN + a grounded citable source ⇒
 * a direct cited answer. Refusals and insufficient evidence may offer support, but
 * they never create a case or claim that a report has been sent.
 */
async function answerInformational(
  ctx: ServiceContext,
  args: InformationalArgs,
): Promise<AnswerView> {
  const {
    symptom,
    config,
    sources,
    requestText,
    conversationContext,
    staffRequester,
    scope,
    intent,
    deps,
  } = args;
  const { safety, unsafeActionRequest } = deriveInformationalSafety(requestText);

  const result = await runAnswerPipeline(
    {
      requestKind: 'lookup',
      rawSymptom: requestText,
      conversationContext,
      effectiveConfigSummary: summarizeConfig(config),
      sources,
      safety,
      requesterScope: scope,
      staffRequester,
      configUncertain: config.overallConfidence === 'LOW',
      unsafeActionRequest,
    },
    deps.llm,
  );

  ctx.auditor.record({
    kind: 'safety',
    action: 'safety.decision',
    zone: result.safetyZone,
    rule: 'classifyZone',
    outcome:
      result.answerMode === 'F'
        ? 'refuse'
        : result.escalationReasons.length > 0
          ? 'escalate'
          : 'allow',
  });
  ctx.auditor.record({
    kind: 'ai_decision',
    action: 'ai.answer',
    symptomKey: symptom?.key ?? `intent:${intent}`,
    serialId: scope.serialId,
    answerMode: result.answerMode,
    safetyZone: result.safetyZone,
    confidence: result.confidence,
    sources: result.emittedFacts.map((f) => ({
      ...(f.provenance.documentId ? { documentId: f.provenance.documentId } : {}),
      tier: f.tier,
      ...(f.provenance.page ? { page: f.provenance.page } : {}),
    })),
    escalated: result.escalationReasons.length > 0,
  });

  const customerMessage =
    result.answerMode === 'F'
      ? REFUSAL_SUMMARY
      : result.answerMode === 'E'
        ? ESCALATION_SUMMARY
        : result.customerText.trim() || composeInformationalFallback(sources);

  return toView(result, {
    staffRequester,
    causeLabels: new Map(),
    caseId: null,
    sources,
    customerMessage,
  });
}

/**
 * Warm handoff  — the LAST resort when the request can neither
 * be answered from the corpus nor diagnosed by a playbook. An explicit defeat/bypass
 * request is refused (Mode F); everything else is a structured escalation (Mode E). A
 * support request is submitted only through the separate confirmed case flow.
 * Missing evidence alone is not a safety hazard. Never leaks unsafe details.
 */
function warmHandoff(
  ctx: ServiceContext,
  args: Pick<InformationalArgs, 'requestText' | 'staffRequester' | 'symptom' | 'intent' | 'scope'>,
): AnswerView {
  const { symptom, requestText, staffRequester, scope } = args;
  const isEnergy = ENERGY_PATTERN.test(requestText);
  const answerMode: AnswerMode = isEnergy && UNSAFE_ACTION_PATTERN.test(requestText) ? 'F' : 'E';
  const safetyZone: SafetyZone = isEnergy ? 'RED' : 'GREEN';
  const summary = answerMode === 'F' ? REFUSAL_SUMMARY : ESCALATION_SUMMARY;

  ctx.auditor.record({
    kind: 'safety',
    action: 'safety.decision',
    zone: safetyZone,
    rule: 'classifyZone',
    outcome: answerMode === 'F' ? 'refuse' : 'escalate',
  });
  ctx.auditor.record({
    kind: 'ai_decision',
    action: 'ai.answer',
    symptomKey: symptom?.key ?? 'unresolved',
    serialId: scope.serialId,
    answerMode,
    safetyZone,
    confidence: 'LOW',
    sources: [],
    escalated: true,
  });

  return {
    answerMode,
    answerModeLabel: ANSWER_MODE_LABELS[answerMode],
    safetyZone,
    safetyZoneLabel: SAFETY_ZONE_LABELS[safetyZone],
    confidence: 'LOW',
    confidenceLabel: CONFIDENCE_BAND_LABELS.LOW,
    customerMessage: summary,
    grounded: false,
    citations: [],
    rankedCauses: staffRequester ? [] : null,
    nextQuestion: null,
    caseId: null,
    internalNote: staffRequester ? `Unresolved (intent: ${args.intent}).` : null,
    escalationReasons: staffRequester ? ['not_source_backed'] : [],
    needsClarification: false,
    clarifyOptions: [],
  };
}

/** A grounded fallback message when the LLM text is empty (offline FakeLlm): point the
 *  customer at the cited approved source rather than inventing prose. */
function composeInformationalFallback(sources: readonly RetrievedSource[]): string {
  const cited = sources.find((s) => s.ref.startsWith('chunk:') && isCustomerCitable(s.tier));
  return cited
    ? 'Based on the approved technical information for this machine — see the cited source below.'
    : 'I could not find approved technical information to answer this for your machine.';
}

/**
 * A deterministic, grounded customer message derived from the engine's own ranked
 * output — used when the LLM text is empty (the no-spend `FakeLlm` default). It
 * states the most-likely cause and the safe next check, so a Mode A/B/C answer is
 * never blank in dev; a live `AnswerResult.text` replaces it verbatim.
 */
function composeFallbackMessage(
  result: Awaited<ReturnType<typeof runAnswerPipeline>>,
  causeLabels: ReadonlyMap<string, string>,
): string {
  const top = result.rankedCauses.find((c) => !c.eliminated);
  const topLabel = top ? (causeLabels.get(top.key) ?? top.key) : null;
  const parts: string[] = [];
  if (topLabel) {
    parts.push(
      `Based on this machine's configuration, the most likely cause is ${topLabel.toLowerCase()}.`,
    );
  }
  if (result.nextQuestion) parts.push(result.nextQuestion.text);
  return parts.join(' ') || 'Here is the diagnosis for the symptom you described.';
}

// --- Helpers ----------------------------------------------------------------

function summarizeConfig(config: ReturnType<typeof buildEffectiveConfig>): string {
  return config.attributes.map((a) => `${a.label}=${String(a.value)}`).join(', ');
}

type SafeStep = ReturnType<typeof selectNextQuestion>;

function deriveSafety(
  requestText: string,
  safeStep: SafeStep,
): { safety: Parameters<typeof runAnswerPipeline>[0]['safety']; unsafeActionRequest: boolean } {
  if (ENERGY_PATTERN.test(requestText)) {
    return {
      safety: { safetyInterlock: true },
      unsafeActionRequest: UNSAFE_ACTION_PATTERN.test(requestText),
    };
  }
  if (safeStep.kind === 'question') {
    // Prefer the step's energy profile; use the authored zone when it is absent.
    const fallback =
      safeStep.step.safetyZone === 'YELLOW'
        ? { approvedLowEnergyObservation: true }
        : { approvedInformationalLookup: true };
    return { safety: safeStep.step.energy ?? fallback, unsafeActionRequest: false };
  }
  if (safeStep.reason === 'no_safe_question') {
    // The only remaining discriminators are RED — proceed unsafely or escalate.
    return { safety: { safetyInterlock: true }, unsafeActionRequest: false };
  }
  return { safety: { approvedInformationalLookup: true }, unsafeActionRequest: false };
}

function toView(
  result: Awaited<ReturnType<typeof runAnswerPipeline>>,
  opts: {
    staffRequester: boolean;
    causeLabels: ReadonlyMap<string, string>;
    caseId: string | null;
    /** Sources used to enrich citations with title, section, and page. */
    sources: readonly RetrievedSource[];
    customerMessage: string;
  },
): AnswerView {
  const showRanked = result.answerMode === 'C' || opts.staffRequester;
  const rankedCauses: AnswerCause[] | null = showRanked
    ? result.rankedCauses
        .filter((c) => !c.eliminated)
        .map((c) => ({
          key: c.key,
          label: opts.causeLabels.get(c.key) ?? c.key,
          confidence: classifyConfidence(c.posterior),
        }))
    : null;

  const sourceByRef = new Map(opts.sources.map((s) => [s.ref, s]));
  const citations: AnswerCitation[] = result.emittedFacts
    .filter((f) => f.tier === 'T1' || f.tier === 'T2')
    .map((f) => {
      const src = sourceByRef.get(f.ref);
      return {
        ref: f.ref,
        tier: f.tier as 'T1' | 'T2',
        ...(f.provenance.documentId ? { documentId: f.provenance.documentId } : {}),
        ...(f.provenance.page ? { page: f.provenance.page } : {}),
        ...(src?.documentTitle ? { title: src.documentTitle } : {}),
        ...(src?.sectionPath ? { sectionPath: src.sectionPath } : {}),
        ...(src?.sectionTitle ? { sectionTitle: src.sectionTitle } : {}),
      };
    });

  return {
    answerMode: result.answerMode,
    answerModeLabel: ANSWER_MODE_LABELS[result.answerMode],
    safetyZone: result.safetyZone,
    safetyZoneLabel: SAFETY_ZONE_LABELS[result.safetyZone],
    confidence: result.confidence,
    confidenceLabel: CONFIDENCE_BAND_LABELS[result.confidence],
    customerMessage: opts.customerMessage,
    grounded: result.grounded,
    citations,
    rankedCauses,
    nextQuestion: result.nextQuestion
      ? { key: result.nextQuestion.key, text: result.nextQuestion.text }
      : null,
    caseId: opts.caseId,
    internalNote: opts.staffRequester ? result.internalNote : null,
    escalationReasons: opts.staffRequester ? result.escalationReasons : [],
    needsClarification: false,
    clarifyOptions: [],
  };
}
