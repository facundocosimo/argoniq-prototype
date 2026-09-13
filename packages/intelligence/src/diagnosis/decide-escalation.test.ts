import { describe, expect, it } from 'vitest';
import { ESCALATION_POLICY } from '@argoniq/core-domain';
import { decideEscalation, type DecideEscalationOptions } from './decide-escalation.js';
import { type RankedPosteriors } from './rank-causes.js';

/**
 *  escalation gate — boundary tests at 0.59 / 0.60 / 0.75 and tie < 0.10.
 * These are the load-bearing thresholds; the under-escalation hole is closed by
 * never auto-resolving below them.
 */

/** Build a two-cause posterior with an explicit top score and a generous margin. */
function posteriors(top: number, margin = 0.5): RankedPosteriors {
  const second = Math.max(0, top - margin);
  return {
    ranked: [
      { key: 'a', posterior: top, eliminated: false },
      { key: 'b', posterior: second, eliminated: false },
    ],
    topScore: top,
    margin: top - second,
  };
}

/** Default opts that, alone, would allow auto-resolve at High (GREEN, source-backed). */
const safeOpts: DecideEscalationOptions = {
  zone: 'GREEN',
  sourceBacked: true,
  preconditionsVerified: false,
  sourceConflict: false,
  configUncertain: false,
  openFleetCluster: false,
  questionsAsked: 0,
};

describe('decideEscalation —  confidence boundaries', () => {
  it('escalates below the 0.60 floor (0.59 → escalate, low_confidence)', () => {
    const d = decideEscalation(posteriors(0.59), safeOpts);
    expect(d.outcome).toBe('escalate');
    if (d.outcome === 'escalate') {
      expect(d.reasons).toContain('low_confidence');
      expect(d.answerMode).toBe('E');
    }
  });

  it('recommends (Mode C) exactly at the 0.60 floor, budget remaining', () => {
    const d = decideEscalation(posteriors(ESCALATION_POLICY.ESCALATE_FLOOR), safeOpts);
    expect(d.outcome).toBe('recommend');
    if (d.outcome === 'recommend') {
      expect(d.answerMode).toBe('C');
      expect(d.confidence).toBe('MEDIUM');
    }
  });

  it('recommends in the Medium band just under 0.75 (0.74)', () => {
    const d = decideEscalation(posteriors(0.74), safeOpts);
    expect(d.outcome).toBe('recommend');
    if (d.outcome === 'recommend') expect(d.answerMode).toBe('C');
  });

  it('auto-resolves (Mode A) exactly at the 0.75 auto-resolve bar, all gates pass', () => {
    const d = decideEscalation(posteriors(ESCALATION_POLICY.AUTO_RESOLVE_MIN), safeOpts);
    expect(d.outcome).toBe('auto_resolve');
    if (d.outcome === 'auto_resolve') {
      expect(d.answerMode).toBe('A');
      expect(d.confidence).toBe('HIGH');
    }
  });

  it('uses Mode B (guided check) for High on precondition-verified YELLOW', () => {
    const d = decideEscalation(posteriors(0.8), {
      ...safeOpts,
      zone: 'YELLOW',
      preconditionsVerified: true,
    });
    expect(d.outcome).toBe('auto_resolve');
    if (d.outcome === 'auto_resolve') expect(d.answerMode).toBe('B');
  });
});

describe('decideEscalation —  tie margin (top-two within 0.10)', () => {
  it('escalates on a tie just under the 0.10 margin even when top is High', () => {
    // top 0.80, second 0.72 → margin 0.08 < 0.10 → ambiguous, must escalate.
    const tie: RankedPosteriors = {
      ranked: [
        { key: 'a', posterior: 0.8, eliminated: false },
        { key: 'b', posterior: 0.72, eliminated: false },
      ],
      topScore: 0.8,
      margin: 0.08,
    };
    const d = decideEscalation(tie, safeOpts);
    expect(d.outcome).toBe('escalate');
    if (d.outcome === 'escalate') expect(d.reasons).toContain('ambiguous_tie');
  });

  it('does NOT escalate for a tie at exactly the 0.10 margin', () => {
    const atMargin: RankedPosteriors = {
      ranked: [
        { key: 'a', posterior: 0.8, eliminated: false },
        { key: 'b', posterior: 0.7, eliminated: false },
      ],
      topScore: 0.8,
      margin: ESCALATION_POLICY.TIE_MARGIN,
    };
    const d = decideEscalation(atMargin, safeOpts);
    expect(d.outcome).toBe('auto_resolve');
  });
});

describe('decideEscalation — per-factor gates cannot manufacture a High auto-send', () => {
  it('a High that is not source-backed never auto-resolves (recommend, then escalate)', () => {
    const withBudget = decideEscalation(posteriors(0.9), { ...safeOpts, sourceBacked: false });
    expect(withBudget.outcome).toBe('recommend');

    const noBudget = decideEscalation(posteriors(0.9), {
      ...safeOpts,
      sourceBacked: false,
      questionsAsked: ESCALATION_POLICY.QUESTION_BUDGET,
    });
    expect(noBudget.outcome).toBe('escalate');
    if (noBudget.outcome === 'escalate') expect(noBudget.reasons).toContain('not_source_backed');
  });

  it('a RED zone forces escalation regardless of a High, source-backed score', () => {
    const d = decideEscalation(posteriors(0.95), { ...safeOpts, zone: 'RED' });
    expect(d.outcome).toBe('escalate');
    if (d.outcome === 'escalate') expect(d.reasons).toContain('red_zone');
  });

  it('an unverified YELLOW High is not auto-send eligible', () => {
    const d = decideEscalation(posteriors(0.9), {
      ...safeOpts,
      zone: 'YELLOW',
      preconditionsVerified: false,
      questionsAsked: ESCALATION_POLICY.QUESTION_BUDGET,
    });
    expect(d.outcome).toBe('escalate');
    if (d.outcome === 'escalate') expect(d.reasons).toContain('unsafe_zone_for_autosend');
  });

  it('source conflict, config uncertainty, and open fleet cluster each escalate a High', () => {
    for (const flag of ['sourceConflict', 'configUncertain', 'openFleetCluster'] as const) {
      const d = decideEscalation(posteriors(0.95), { ...safeOpts, [flag]: true });
      expect(d.outcome).toBe('escalate');
    }
  });

  it('exhausting the question budget on a Medium leader escalates (non-convergence)', () => {
    const d = decideEscalation(posteriors(0.7), {
      ...safeOpts,
      questionsAsked: ESCALATION_POLICY.QUESTION_BUDGET,
    });
    expect(d.outcome).toBe('escalate');
    if (d.outcome === 'escalate') expect(d.reasons).toContain('low_confidence');
  });
});
