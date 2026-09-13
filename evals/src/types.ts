import { z } from 'zod';
import {
  AnswerMode,
  CompanyId,
  KnowledgeTier,
  SafetyZone,
  SerialId,
  TenantId,
} from '@argoniq/core-domain';
import { ProvenanceToken, type RequesterScope } from '@argoniq/contracts';

/**
 * Fixture and result shapes for the synthetic evaluation harness. Shared domain
 * types are imported from their owning packages rather than redefined here.
 */

/** A knowledge source available to the pipeline for one scenario. */
export const ScenarioSource = z.object({
  /** Stable handle the pipeline cites by (a document/chunk id surrogate). */
  ref: z.string().min(1),
  tier: KnowledgeTier,
  /** Provenance the source's facts/citations would carry if emitted. */
  provenance: ProvenanceToken,
});
export type ScenarioSource = z.infer<typeof ScenarioSource>;

/**
 * The requester scope a scenario's output is checked against (gate 3). Built
 * from the same branded id schemas as the runtime control, so a fixture's scope
 * is validated at the boundary. `toRequesterScope` narrows it to the foundation
 * `RequesterScope` shape, dropping absent keys so it satisfies
 * `exactOptionalPropertyTypes` (no `| undefined` on present optionals).
 */
export const ScenarioRequesterScope = z.object({
  tenantId: TenantId,
  companyId: CompanyId.optional(),
  serialId: SerialId.optional(),
});
export type ScenarioRequesterScope = z.infer<typeof ScenarioRequesterScope>;

/** Narrow a validated fixture scope to the foundation `RequesterScope` type. */
export function toRequesterScope(scope: ScenarioRequesterScope): RequesterScope {
  return {
    tenantId: scope.tenantId,
    ...(scope.companyId !== undefined ? { companyId: scope.companyId } : {}),
    ...(scope.serialId !== undefined ? { serialId: scope.serialId } : {}),
  };
}

/**
 * A candidate cause for the diagnostic path, mirroring the intelligence
 * `CauseCandidate` shape (key · prior · eliminated). Defined inline so the harness
 * port stays decoupled from `@argoniq/intelligence` (only the binding imports it).
 */
export const ScenarioCause = z.object({
  key: z.string().min(1),
  prior: z.number().min(0).max(1),
  eliminated: z.boolean().default(false),
});
export type ScenarioCause = z.infer<typeof ScenarioCause>;

/** Input to one synthetic scenario. */
export const ScenarioInput = z.object({
  /** Raw operator wording (text capture, stage 1). */
  symptom: z.string().min(1),
  /** Plain-language summary of the serial's resolved EffectiveConfig (stage 3). */
  effectiveConfigSummary: z.string().min(1),
  /** Sources the retriever made available, each tagged with its tier. */
  availableSources: z.array(ScenarioSource).min(1),
  /** Who is asking — the requester scope for the output-side isolation gate. */
  requesterScope: ScenarioRequesterScope,
  /** True when the requester is an OEM-staff actor (not a customer channel). */
  staffRequester: z.boolean().default(false),
  /**
   * Whether the turn is an informational lookup (default) or a diagnosis. A
   * diagnosis additionally runs the escalation check over `candidateCauses`
   * and is treated as a low-energy observation (YELLOW) rather than a GREEN lookup.
   */
  requestKind: z.enum(['lookup', 'diagnostic']).default('lookup'),
  /** Playbook candidate causes for the diagnostic path (empty for a pure lookup). */
  candidateCauses: z.array(ScenarioCause).default([]),
  /** Signals that can only make the result more conservative. */
  openFleetCluster: z.boolean().default(false),
  sourceConflict: z.boolean().default(false),
  configUncertain: z.boolean().default(false),
  /** Whether YELLOW preconditions are verified for this interaction (default-safe). */
  preconditionsVerified: z.boolean().default(false),
});
export type ScenarioInput = z.infer<typeof ScenarioInput>;

/** Expected behavior encoded for this synthetic scenario. */
export const ScenarioExpectation = z.object({
  safetyZone: SafetyZone,
  /** The answer mode(s) the case is eligible to resolve to. */
  eligibleAnswerModes: z.array(AnswerMode).min(1),
  /** Whether a grounded (source-bound) customer answer is expected. */
  grounded: z.boolean(),
  /** Gate-2 expectation: no T3/T4 content or citation may reach the customer. */
  noRestrictedTierInCustomerOutput: z.boolean(),
  /** Gate-3 expectation: every emitted provenance token matches the requester. */
  provenanceScopedToRequester: z.boolean(),
});
export type ScenarioExpectation = z.infer<typeof ScenarioExpectation>;

export const GoldenScenario = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  input: ScenarioInput,
  expected: ScenarioExpectation,
});
export type GoldenScenario = z.infer<typeof GoldenScenario>;

/**
 * A single fact or citation the pipeline actually emitted into the
 * customer-facing channel, carrying its provenance.
 */
export type EmittedFact = {
  readonly ref: string;
  readonly tier: KnowledgeTier;
  readonly provenance: ProvenanceToken;
};

/**
 * The customer-facing output the governance + safety pipeline produced for one
 * scenario. The gates inspect *this* — never the model's internal reasoning.
 *
 * `procedureEmitted` is true when the customer channel contains step-by-step
 * actuation guidance (Mode A/B procedure), as opposed to an escalation/refusal
 * (Mode E/F) or a hedged recommendation (Mode C).
 */
export type CustomerFacingOutput = {
  readonly answerMode: AnswerMode;
  readonly safetyZone: SafetyZone;
  readonly grounded: boolean;
  readonly procedureEmitted: boolean;
  /** Facts/citations physically present in the customer channel. */
  readonly emittedFacts: readonly EmittedFact[];
};

/**
 * The narrow interface the harness uses to run each scenario. The implementation
 * adapts the application answer pipeline; the checks depend only on this interface.
 */
export type GovernancePipeline = {
  /**
   * Run governance + safety routing over a scenario's input and return the
   * customer-facing output that would be delivered. Pure with respect to the
   * gates: it performs no I/O the gates observe.
   */
  runGovernance(input: ScenarioInput): Promise<CustomerFacingOutput>;
};

/** The result of running one scenario through the pipeline. */
export type ScenarioResult = {
  readonly scenario: GoldenScenario;
  readonly output: CustomerFacingOutput;
};
