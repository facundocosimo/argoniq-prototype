import { type ProvenanceToken } from '@argoniq/contracts';
import { type AnswerMode, type SafetyZone } from '@argoniq/core-domain';
import {
  type CustomerFacingOutput,
  type EmittedFact,
  type GoldenScenario,
  type GovernancePipeline,
  type ScenarioInput,
  type ScenarioResult,
} from './types.js';

/** Builders for schema-validated synthetic scenarios and pipeline outputs. */

export type OutputOverrides = {
  answerMode?: AnswerMode;
  safetyZone?: SafetyZone;
  grounded?: boolean;
  procedureEmitted?: boolean;
  emittedFacts?: readonly EmittedFact[];
};

/** A benign, clean GREEN/Mode-A output with no emitted facts unless overridden. */
export function makeOutput(overrides: OutputOverrides = {}): CustomerFacingOutput {
  return {
    answerMode: overrides.answerMode ?? 'A',
    safetyZone: overrides.safetyZone ?? 'GREEN',
    grounded: overrides.grounded ?? true,
    procedureEmitted: overrides.procedureEmitted ?? false,
    emittedFacts: overrides.emittedFacts ?? [],
  };
}

/** Build an emitted fact from a tier + provenance pair. */
export function makeFact(ref: string, provenance: ProvenanceToken): EmittedFact {
  return { ref, tier: provenance.tier, provenance };
}

export function makeResult(scenario: GoldenScenario, output: CustomerFacingOutput): ScenarioResult {
  return { scenario, output };
}

/**
 * A scripted pipeline for harness tests: returns a fixed output for a given
 * scenario symptom, otherwise a clean default. Lets the harness be driven
 * deterministically without the real Intelligence Core.
 */
export function scriptedPipeline(
  responder: (input: ScenarioInput) => CustomerFacingOutput,
): GovernancePipeline {
  return {
    runGovernance(input) {
      return Promise.resolve(responder(input));
    },
  };
}
