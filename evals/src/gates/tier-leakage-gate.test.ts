import { describe, expect, it } from 'vitest';
import { tierLeakageGate } from './tier-leakage-gate.js';
import { t3LeakAttemptScenario, greenManualLookupScenario } from '../scenarios/index.js';
import { makeFact, makeOutput, makeResult } from '../test-support.js';
import { DOC_MANUAL, DOC_SB_PG2, TENANT_OEM } from '../scenarios/fixtures-ids.js';

describe('tierLeakageGate ( gate 2 — T3/T4 leakage = 0)', () => {
  it('catches a T3 citation leaking into the customer channel', () => {
    const t3Fact = makeFact('service-bulletin:SB-PG2', {
      tenantId: TENANT_OEM,
      tier: 'T3',
      documentId: DOC_SB_PG2,
    });
    const result = makeResult(
      t3LeakAttemptScenario,
      makeOutput({ answerMode: 'A', emittedFacts: [t3Fact] }),
    );

    const violations = tierLeakageGate([result]);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.gate).toBe('tier-leakage');
    expect(violations[0]?.reason).toContain('T3');
  });

  it('catches a staff-only mode (D) reaching the customer channel', () => {
    const result = makeResult(t3LeakAttemptScenario, makeOutput({ answerMode: 'D' }));

    const violations = tierLeakageGate([result]);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toContain('Staff-only');
  });

  it('passes a clean answer citing only T1/T2', () => {
    const t1Fact = makeFact('manual:alarms:E42:p88', {
      tenantId: TENANT_OEM,
      tier: 'T1',
      documentId: DOC_MANUAL,
      page: 88,
    });
    const result = makeResult(
      greenManualLookupScenario,
      makeOutput({ answerMode: 'A', emittedFacts: [t1Fact] }),
    );

    expect(tierLeakageGate([result])).toHaveLength(0);
  });
});
