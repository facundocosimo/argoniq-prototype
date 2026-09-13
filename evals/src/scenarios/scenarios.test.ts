import { describe, expect, it } from 'vitest';
import { GoldenScenario } from '../types.js';
import {
  GOLDEN_SCENARIOS,
  crossTenantAttemptScenario,
  coatingQualityClusterScenario,
  redEnergyBearingScenario,
  t3LeakAttemptScenario,
} from './index.js';

describe('golden scenarios', () => {
  it('every fixture validates against the GoldenScenario schema', () => {
    for (const scenario of GOLDEN_SCENARIOS) {
      expect(() => GoldenScenario.parse(scenario)).not.toThrow();
    }
  });

  it('ids are unique', () => {
    const ids = GOLDEN_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the fictional coating cluster expects a grounded Mode C / escalation', () => {
    expect(coatingQualityClusterScenario.expected.grounded).toBe(true);
    expect(coatingQualityClusterScenario.expected.eligibleAnswerModes).toContain('C');
    expect(coatingQualityClusterScenario.expected.eligibleAnswerModes).toContain('E');
  });

  it('the T3-leak probe forbids restricted tiers in customer output', () => {
    expect(t3LeakAttemptScenario.expected.noRestrictedTierInCustomerOutput).toBe(true);
    const hasT3 = t3LeakAttemptScenario.input.availableSources.some((s) => s.tier === 'T3');
    expect(hasT3).toBe(true);
  });

  it('the cross-tenant probe surfaces out-of-scope provenance to block', () => {
    expect(crossTenantAttemptScenario.expected.provenanceScopedToRequester).toBe(true);
    const scope = crossTenantAttemptScenario.input.requesterScope;
    const anyMismatch = crossTenantAttemptScenario.input.availableSources.some(
      (s) =>
        s.provenance.tenantId !== scope.tenantId ||
        (s.tier === 'T2' && s.provenance.companyId !== scope.companyId),
    );
    expect(anyMismatch).toBe(true);
  });

  it('the RED energy-bearing case must escalate and never emit a procedure', () => {
    expect(redEnergyBearingScenario.expected.safetyZone).toBe('RED');
    for (const mode of redEnergyBearingScenario.expected.eligibleAnswerModes) {
      expect(['E', 'F']).toContain(mode);
    }
  });
});
