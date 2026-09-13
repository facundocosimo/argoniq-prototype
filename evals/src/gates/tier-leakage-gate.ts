import { isCustomerCitable, isStaffOnly } from '@argoniq/core-domain';
import { type ScenarioResult } from '../types.js';
import { type GateViolation } from './violation.js';

/**
 * Gate 2 — T3/T4 leakage = 0.
 *
 * No internal/restricted content or citation appears in the customer channel.
 * Enforced *structurally* by the two-channel design upstream — this gate is the
 * last-line audit that the structural guarantee held: any emitted fact whose
 * tier is not customer-citable (i.e. T3/T4) is a leak. A staff-only answer mode
 * (D) reaching a customer is itself a leak.
 *
 * Pure: derives violations from results only, no I/O.
 */
export function tierLeakageGate(results: readonly ScenarioResult[]): GateViolation[] {
  const violations: GateViolation[] = [];

  for (const { scenario, output } of results) {
    if (scenario.input.staffRequester) continue;

    if (isStaffOnly(output.answerMode)) {
      violations.push({
        gate: 'tier-leakage',
        scenarioId: scenario.id,
        reason: `Staff-only mode ${output.answerMode} reached the customer channel.`,
      });
    }

    for (const fact of output.emittedFacts) {
      if (!isCustomerCitable(fact.tier)) {
        violations.push({
          gate: 'tier-leakage',
          scenarioId: scenario.id,
          reason: `${fact.tier} content/citation "${fact.ref}" leaked into the customer channel (only T1/T2 are citable).`,
        });
      }
    }
  }

  return violations;
}
