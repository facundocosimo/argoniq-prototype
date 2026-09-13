/**
 * Adapter between the synthetic evaluation harness and `runAnswerPipeline`.
 * It uses the same pipeline function as the application with a deterministic
 * `FakeLlm`, so the checks run without network access or model spend.
 */
import { FakeLlm, runAnswerPipeline } from '@argoniq/intelligence';
import {
  type CustomerFacingOutput,
  type GovernancePipeline,
  type ScenarioInput,
  toRequesterScope,
} from './types.js';

/**
 * Energy-bearing or hazard wording forces a RED safety context. A
 * diagnostic turn is otherwise a low-energy observation (YELLOW); a pure lookup is
 * an approved informational request (GREEN). The deterministic `classifyZone` rule
 * inside the pipeline then decides — the LLM is never trusted with the zone.
 */
const ENERGY_PATTERN =
  /\b(bypass|interlock|lockout|loto|pressuri[sz]|accumulator|energ|electric|live|capacitor|hot\s|suspended|spring|moving part|guard removal)\b/i;

/** An explicit request to defeat a safety control ⇒ refuse (Mode F), not just escalate. */
const UNSAFE_ACTION_PATTERN = /\b(bypass|override|defeat|disable)\b/i;

type SafetyOverride = Parameters<typeof runAnswerPipeline>[0]['safety'];

function deriveSafety(symptom: string, requestKind: ScenarioInput['requestKind']): SafetyOverride {
  if (ENERGY_PATTERN.test(symptom)) return { safetyInterlock: true };
  if (requestKind === 'diagnostic') return { approvedLowEnergyObservation: true };
  return { approvedInformationalLookup: true };
}

/** One deterministic local model stub for the synthetic scenario set. */
const llm = new FakeLlm();

async function runOnce(input: ScenarioInput): Promise<CustomerFacingOutput> {
  const scope = toRequesterScope(input.requesterScope);

  const result = await runAnswerPipeline(
    {
      requestKind: input.requestKind,
      rawSymptom: input.symptom,
      effectiveConfigSummary: input.effectiveConfigSummary,
      // The eval supplies tier + provenance; text is not needed (gates inspect
      // provenance/tier, not generated prose). The pipeline's gate 2 + gate 3 run for real.
      sources: input.availableSources.map((s) => ({
        ref: s.ref,
        tier: s.tier,
        text: '',
        forbiddenForCustomerFacing: false,
        provenance: s.provenance,
      })),
      candidateCauses: input.candidateCauses.map((c) => ({
        key: c.key,
        prior: c.prior,
        eliminated: c.eliminated,
      })),
      preconditionsVerified: input.preconditionsVerified,
      safety: deriveSafety(input.symptom, input.requestKind),
      requesterScope: scope,
      staffRequester: input.staffRequester,
      sourceConflict: input.sourceConflict,
      configUncertain: input.configUncertain,
      openFleetCluster: input.openFleetCluster,
      unsafeActionRequest: UNSAFE_ACTION_PATTERN.test(input.symptom),
    },
    llm,
  );

  return {
    answerMode: result.answerMode,
    safetyZone: result.safetyZone,
    grounded: result.grounded,
    procedureEmitted: result.procedureEmitted,
    emittedFacts: result.emittedFacts.map((f) => ({
      ref: f.ref,
      tier: f.tier,
      provenance: f.provenance,
    })),
  };
}

/** Expose the application answer pipeline through the harness interface. */
export function resolveGovernancePipeline(): GovernancePipeline {
  return {
    runGovernance: (input: ScenarioInput): Promise<CustomerFacingOutput> => runOnce(input),
  };
}
