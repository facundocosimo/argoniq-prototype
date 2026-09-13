import { describe, expect, it } from 'vitest';
import { type PlaybookStep } from '@argoniq/core-domain';
import { type RankedCause } from '../diagnosis/rank-causes.js';
import { informationGain, selectNextQuestion } from './select-next-question.js';

function step(
  key: string,
  zone: PlaybookStep['safetyZone'],
  discriminatesCauseKeys: string[],
): PlaybookStep {
  return {
    key,
    kind: 'question',
    text: `Question ${key}`,
    safetyZone: zone,
    requiresPreconditions: zone === 'YELLOW',
    discriminatesCauseKeys,
  };
}

const causes: RankedCause[] = [
  { key: 'a', posterior: 0.5, eliminated: false },
  { key: 'b', posterior: 0.5, eliminated: false },
];

describe('informationGain — discriminating-power heuristic', () => {
  it('peaks (1.0) when a step splits belief mass in half', () => {
    expect(informationGain(step('q', 'GREEN', ['a']), causes)).toBeCloseTo(1, 10);
  });

  it('is zero when a step touches no live cause', () => {
    expect(informationGain(step('q', 'GREEN', ['z']), causes)).toBe(0);
  });

  it('is zero when a step touches every live cause (splits nothing)', () => {
    expect(informationGain(step('q', 'GREEN', ['a', 'b']), causes)).toBe(0);
  });
});

describe('selectNextQuestion — max gain after the safety filter ', () => {
  it('picks the most discriminating askable GREEN question', () => {
    const result = selectNextQuestion({
      steps: [
        step('weak', 'GREEN', ['a', 'b']), // gain 0
        step('strong', 'GREEN', ['a']), // gain 1
      ],
      rankedCauses: causes,
      askedStepKeys: [],
      preconditionsVerified: false,
    });
    expect(result.kind).toBe('question');
    if (result.kind === 'question') expect(result.step.key).toBe('strong');
  });

  it('never asks a RED question, and signals no_safe_question to force escalation', () => {
    const result = selectNextQuestion({
      steps: [step('red', 'RED', ['a'])],
      rankedCauses: causes,
      askedStepKeys: [],
      preconditionsVerified: false,
    });
    expect(result.kind).toBe('none');
    if (result.kind === 'none') expect(result.reason).toBe('no_safe_question');
  });

  it('filters out a YELLOW question until preconditions are verified', () => {
    const unverified = selectNextQuestion({
      steps: [step('yellow', 'YELLOW', ['a'])],
      rankedCauses: causes,
      askedStepKeys: [],
      preconditionsVerified: false,
    });
    expect(unverified.kind).toBe('none');
    if (unverified.kind === 'none') expect(unverified.reason).toBe('no_safe_question');

    const verified = selectNextQuestion({
      steps: [step('yellow', 'YELLOW', ['a'])],
      rankedCauses: causes,
      askedStepKeys: [],
      preconditionsVerified: true,
    });
    expect(verified.kind).toBe('question');
  });

  it('skips already-asked questions', () => {
    const result = selectNextQuestion({
      steps: [step('strong', 'GREEN', ['a'])],
      rankedCauses: causes,
      askedStepKeys: ['strong'],
      preconditionsVerified: false,
    });
    expect(result.kind).toBe('none');
    if (result.kind === 'none') expect(result.reason).toBe('no_discriminator');
  });

  it('reports no_discriminator when remaining safe questions split nothing', () => {
    const result = selectNextQuestion({
      steps: [step('weak', 'GREEN', ['a', 'b'])],
      rankedCauses: causes,
      askedStepKeys: [],
      preconditionsVerified: false,
    });
    expect(result.kind).toBe('none');
    if (result.kind === 'none') expect(result.reason).toBe('no_discriminator');
  });
});
