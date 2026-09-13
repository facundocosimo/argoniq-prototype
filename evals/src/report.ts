import { ANSWER_MODE_LABELS, SAFETY_ZONE_LABELS } from '@argoniq/core-domain';
import { type HarnessReport } from './harness.js';

/**
 * Render a human-readable, plain-text gate report. Returned as a string so the
 * caller emits it through the centralized logger (no `console.*`). Gates are
 * shown as PASS/FAIL with raw violation counts rather than an average.
 */
export function renderReport(report: HarnessReport): string {
  const lines: string[] = [];

  lines.push('ArgonIQ safety and isolation report');
  lines.push('='.repeat(48));
  lines.push(`Scenarios run: ${report.results.length}`);
  lines.push('');

  lines.push('Per-scenario outcome:');
  for (const { scenario, output } of report.results) {
    lines.push(
      `  • ${scenario.id} — mode ${output.answerMode} (${ANSWER_MODE_LABELS[output.answerMode]}), ` +
        `zone ${output.safetyZone} (${SAFETY_ZONE_LABELS[output.safetyZone]}), ` +
        `grounded=${output.grounded}, procedure=${output.procedureEmitted}, ` +
        `facts=${output.emittedFacts.length}`,
    );
  }
  lines.push('');

  lines.push('Gates (pass/fail — 0 tolerance, never averaged):');
  for (const gate of report.gates) {
    const status = gate.passed ? 'PASS' : 'FAIL';
    lines.push(`  [${status}] ${gate.gate}: ${gate.violations.length} violation(s)`);
    for (const v of gate.violations) {
      lines.push(`        ✗ ${v.scenarioId}: ${v.reason}`);
    }
  }
  lines.push('');

  lines.push(
    report.passed
      ? `RESULT: PASS — 0 violations across all gates.`
      : `RESULT: FAIL — ${report.totalViolations} violation(s). Release blocked.`,
  );

  return lines.join('\n');
}
