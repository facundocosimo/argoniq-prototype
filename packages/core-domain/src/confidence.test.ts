import { describe, expect, it } from 'vitest';
import { ESCALATION_POLICY, classifyConfidence } from './confidence.js';

describe('classifyConfidence', () => {
  it('maps scores to bands at the  boundaries', () => {
    expect(classifyConfidence(0.75)).toBe('HIGH');
    expect(classifyConfidence(0.9)).toBe('HIGH');
    expect(classifyConfidence(0.74)).toBe('MEDIUM');
    expect(classifyConfidence(0.6)).toBe('MEDIUM');
    expect(classifyConfidence(0.59)).toBe('LOW');
    expect(classifyConfidence(0)).toBe('LOW');
  });
});

describe('ESCALATION_POLICY', () => {
  it('pins the conservative floor from ', () => {
    expect(ESCALATION_POLICY.ESCALATE_FLOOR).toBe(0.6);
    expect(ESCALATION_POLICY.AUTO_RESOLVE_MIN).toBe(0.75);
    expect(ESCALATION_POLICY.TIE_MARGIN).toBe(0.1);
  });
});
