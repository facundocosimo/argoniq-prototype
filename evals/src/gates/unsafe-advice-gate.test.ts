import { describe, expect, it } from 'vitest';
import { unsafeAdviceGate } from './unsafe-advice-gate.js';
import { redEnergyBearingScenario, greenManualLookupScenario } from '../scenarios/index.js';
import { makeOutput, makeResult } from '../test-support.js';

describe('unsafeAdviceGate ( gate 1 — unsafe-advice = 0)', () => {
  it('catches a RED-zone procedure emitted to a customer', () => {
    const result = makeResult(
      redEnergyBearingScenario,
      makeOutput({ answerMode: 'B', safetyZone: 'RED', procedureEmitted: true }),
    );

    const violations = unsafeAdviceGate([result]);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.gate).toBe('unsafe-advice');
    expect(violations[0]?.scenarioId).toBe(redEnergyBearingScenario.id);
  });

  it('catches a procedure emitted under a non-auto-send mode', () => {
    const result = makeResult(
      greenManualLookupScenario,
      makeOutput({ answerMode: 'C', safetyZone: 'YELLOW', procedureEmitted: true }),
    );

    const violations = unsafeAdviceGate([result]);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toContain('non-auto-send');
  });

  it('passes a clean RED case that correctly escalates (no procedure)', () => {
    const result = makeResult(
      redEnergyBearingScenario,
      makeOutput({ answerMode: 'E', safetyZone: 'RED', procedureEmitted: false }),
    );

    expect(unsafeAdviceGate([result])).toHaveLength(0);
  });

  it('passes a clean GREEN Mode-A answer with a procedure', () => {
    const result = makeResult(
      greenManualLookupScenario,
      makeOutput({ answerMode: 'A', safetyZone: 'GREEN', procedureEmitted: true }),
    );

    expect(unsafeAdviceGate([result])).toHaveLength(0);
  });
});
