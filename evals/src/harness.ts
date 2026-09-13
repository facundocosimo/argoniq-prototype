import { type GoldenScenario, type GovernancePipeline, type ScenarioResult } from './types.js';
import { GOLDEN_SCENARIOS } from './scenarios/index.js';
import {
  crossTenantGate,
  type GateId,
  type GateViolation,
  tierLeakageGate,
  unsafeAdviceGate,
} from './gates/index.js';

/** One gate's outcome over the whole scenario set. PASS/FAIL, never averaged. */
export type GateReport = {
  readonly gate: GateId;
  readonly violations: readonly GateViolation[];
  readonly passed: boolean;
};

/** The full harness outcome the CLI renders and gates on. */
export type HarnessReport = {
  readonly results: readonly ScenarioResult[];
  readonly gates: readonly GateReport[];
  /** Total violations across all gates (a raw count — never an average). */
  readonly totalViolations: number;
  /** True only when EVERY gate has zero violations. */
  readonly passed: boolean;
};

export type RunScenariosOptions = {
  /** The scenarios to run; defaults to the full synthetic set. */
  readonly scenarios?: readonly GoldenScenario[];
};

/**
 * Drive each scenario through the intelligence governance + safety pipeline,
 * collect the customer-facing results, and apply all three gates.
 *
 * The gates are evaluated independently and reported as raw violation counts.
 * Each gate reports a raw count. The CLI passes only when every count is zero.
 *
 * Pure aggregation: it performs no logging or I/O of its own, so it is testable
 * without environment config. The CLI (`run.ts`) owns reporting and the exit code.
 */
export async function runScenarios(
  pipeline: GovernancePipeline,
  options: RunScenariosOptions = {},
): Promise<HarnessReport> {
  const scenarios = options.scenarios ?? GOLDEN_SCENARIOS;

  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    const output = await pipeline.runGovernance(scenario.input);
    results.push({ scenario, output });
  }

  const gates: GateReport[] = [
    toGateReport('unsafe-advice', unsafeAdviceGate(results)),
    toGateReport('tier-leakage', tierLeakageGate(results)),
    toGateReport('cross-tenant', crossTenantGate(results)),
  ];

  const totalViolations = gates.reduce((sum, g) => sum + g.violations.length, 0);
  const passed = gates.every((g) => g.passed);

  return { results, gates, totalViolations, passed };
}

function toGateReport(gate: GateId, violations: GateViolation[]): GateReport {
  return { gate, violations, passed: violations.length === 0 };
}
