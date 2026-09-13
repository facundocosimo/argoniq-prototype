/* eslint-disable no-restricted-globals -- CI gate entrypoint: must run OFFLINE (no app env/secrets) and set the process exit code. */
/**
 * CI entrypoint (`tsx src/run.ts`, npm script `test:eval`).
 *
 * Runs the fixed regression scenarios through the answer pipeline, prints a
 * readable report, and sets a non-zero exit code if any check finds a
 * violation. Each check passes or fails independently; counts are not averaged.
 *
 * Deliberately decoupled from the app logger/env: the gate must run with NO
 * secrets in CI, so it writes to stdout directly rather than through
 * `getLogger()` (which fail-fast-validates production config).
 */
import { runScenarios } from './harness.js';
import { renderReport } from './report.js';
import { resolveGovernancePipeline } from './pipeline-binding.js';

function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

export async function main(): Promise<void> {
  const report = await runScenarios(resolveGovernancePipeline());
  print(renderReport(report));

  if (!report.passed) {
    const failing = report.gates
      .filter((gate) => !gate.passed)
      .map((gate) => `${gate.gate}=${gate.violations.length}`)
      .join(', ');
    print(
      `\n✗ Release blocked by safety or isolation checks: ${failing} ` +
        `(${report.totalViolations} total violation(s), never averaged).`,
    );
    process.exitCode = 1;
    return;
  }

  print('\n✓ All safety and isolation checks passed — 0 violations.');
}

await main();
