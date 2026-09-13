/**
 * Synthetic regression scenarios and checks for unsafe advice, restricted-data
 * leakage, and tenant isolation. Each check reports its own violation count and
 * fails the command when any violation is found. The CLI entrypoint is
 * `src/run.ts`; it is not re-exported because it runs the harness on import.
 */

// Fixture + observation shapes and the governance pipeline port.
export {
  GoldenScenario,
  ScenarioInput,
  ScenarioExpectation,
  ScenarioSource,
  ScenarioRequesterScope,
  toRequesterScope,
  type CustomerFacingOutput,
  type EmittedFact,
  type GovernancePipeline,
  type ScenarioResult,
} from './types.js';

// The three gates + their shared violation shape.
export {
  unsafeAdviceGate,
  tierLeakageGate,
  crossTenantGate,
  type GateId,
  type GateViolation,
  GATE_IDS,
} from './gates/index.js';

// The harness that drives scenarios through the pipeline and applies the gates.
export {
  runScenarios,
  type GateReport,
  type HarnessReport,
  type RunScenariosOptions,
} from './harness.js';

// The synthetic scenario set.
export {
  GOLDEN_SCENARIOS,
  coatingQualityClusterScenario,
  t3LeakAttemptScenario,
  crossTenantAttemptScenario,
  redEnergyBearingScenario,
  greenManualLookupScenario,
} from './scenarios/index.js';

// The readable report renderer.
export { renderReport } from './report.js';
