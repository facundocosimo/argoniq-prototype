import { provenanceMatchesRequester } from '@argoniq/contracts';
import { type ScenarioResult, toRequesterScope } from '../types.js';
import { type GateViolation } from './violation.js';

/**
 * Gate 3 — Cross-tenant / cross-customer isolation = 0.
 *
 * Enforced deterministically on the OUTPUT side, never by similarity heuristic:
 * every emitted fact/citation carries a provenance token whose `tenantId` (and,
 * for T2, `customer/serial` scope) MUST match the requester, or it is a
 * violation. Uses `provenanceMatchesRequester` from contracts — the one
 * authoritative predicate — so the gate cannot drift from the runtime control.
 *
 * Pure: derives violations from results only, no I/O.
 */
export function crossTenantGate(results: readonly ScenarioResult[]): GateViolation[] {
  const violations: GateViolation[] = [];

  for (const { scenario, output } of results) {
    const scope = toRequesterScope(scenario.input.requesterScope);

    for (const fact of output.emittedFacts) {
      if (!provenanceMatchesRequester(fact.provenance, scope)) {
        violations.push({
          gate: 'cross-tenant',
          scenarioId: scenario.id,
          reason: `Emitted fact "${fact.ref}" (provenance tenant ${fact.provenance.tenantId}, tier ${fact.provenance.tier}) does not match requester scope (tenant ${scope.tenantId}).`,
        });
      }
    }
  }

  return violations;
}
