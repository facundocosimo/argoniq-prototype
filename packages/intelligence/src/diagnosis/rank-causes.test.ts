import { describe, expect, it } from 'vitest';
import { MAX_FACTOR, MIN_FACTOR, POSTERIOR_FLOOR, rankCauses } from './rank-causes.js';

describe('rankCauses — caps, floor, elimination', () => {
  it('normalizes posteriors to sum to 1 across non-eliminated causes', () => {
    const { ranked } = rankCauses({
      candidates: [
        { key: 'a', prior: 0.5, eliminated: false },
        { key: 'b', prior: 0.3, eliminated: false },
        { key: 'c', prior: 0.2, eliminated: false },
      ],
      evidence: [],
    });
    const sum = ranked.reduce((acc, r) => acc + r.posterior, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('clamps a single oversized evidence factor to MAX_FACTOR (no runaway swing)', () => {
    const capped = rankCauses({
      candidates: [
        { key: 'a', prior: 0.4, eliminated: false },
        { key: 'b', prior: 0.4, eliminated: false },
      ],
      evidence: [{ causeKey: 'a', factor: 100 }],
    });
    const equivalent = rankCauses({
      candidates: [
        { key: 'a', prior: 0.4, eliminated: false },
        { key: 'b', prior: 0.4, eliminated: false },
      ],
      evidence: [{ causeKey: 'a', factor: MAX_FACTOR }],
    });
    expect(capped.topScore).toBeCloseTo(equivalent.topScore, 10);
    // With one cause at MAX_FACTOR (3×) over an equal prior, its share is 3/4.
    expect(capped.topScore).toBeCloseTo(0.75, 10);
  });

  it('clamps a tiny factor up to MIN_FACTOR', () => {
    const d = rankCauses({
      candidates: [
        { key: 'a', prior: 0.5, eliminated: false },
        { key: 'b', prior: 0.5, eliminated: false },
      ],
      evidence: [{ causeKey: 'a', factor: 0.0001 }],
    });
    const a = d.ranked.find((r) => r.key === 'a');
    // a = 0.5 * MIN_FACTOR (0.3) = 0.15; b = 0.5; share of a = 0.15 / 0.65.
    expect(a?.posterior).toBeCloseTo(0.15 / 0.65, 10);
    expect(MIN_FACTOR).toBe(0.3);
  });

  it('floors a non-eliminated cause so soft evidence never zeroes it', () => {
    const d = rankCauses({
      candidates: [
        { key: 'a', prior: 0.9, eliminated: false },
        { key: 'b', prior: 0.001, eliminated: false },
      ],
      evidence: [{ causeKey: 'b', factor: MIN_FACTOR }],
    });
    const b = d.ranked.find((r) => r.key === 'b');
    // b's raw score is floored at POSTERIOR_FLOOR before normalization.
    expect((b?.posterior ?? 0) > 0).toBe(true);
    expect(POSTERIOR_FLOOR).toBeGreaterThan(0);
  });

  it('only an eliminated cause gets zero posterior (bypasses the floor)', () => {
    const d = rankCauses({
      candidates: [
        { key: 'a', prior: 0.5, eliminated: false },
        { key: 'b', prior: 0.5, eliminated: true },
      ],
      evidence: [],
    });
    const b = d.ranked.find((r) => r.key === 'b');
    expect(b?.posterior).toBe(0);
    expect(b?.eliminated).toBe(true);
  });
});
