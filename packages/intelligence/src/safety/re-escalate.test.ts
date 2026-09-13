import { describe, expect, it } from 'vitest';
import { reEscalateOnEvidence } from './re-escalate.js';

describe('reEscalateOnEvidence — monotonic  Stage-7 re-classification', () => {
  it('a RED hazard cue overrides a prior GREEN/YELLOW branch zone', () => {
    expect(reEscalateOnEvidence({ currentZone: 'GREEN', cues: ['solvent_or_fuel_smell'] })).toBe(
      'RED',
    );
    expect(reEscalateOnEvidence({ currentZone: 'YELLOW', cues: ['pressurized_leak'] })).toBe('RED');
  });

  it('a benign cue can never lower an already-RED zone (monotonic)', () => {
    expect(reEscalateOnEvidence({ currentZone: 'RED', cues: ['unexplained_minor_noise'] })).toBe(
      'RED',
    );
  });

  it('with no cues, the zone is unchanged', () => {
    expect(reEscalateOnEvidence({ currentZone: 'YELLOW', cues: [] })).toBe('YELLOW');
  });

  it('a low-energy cue raises GREEN to YELLOW but not to RED', () => {
    expect(reEscalateOnEvidence({ currentZone: 'GREEN', cues: ['unexplained_minor_noise'] })).toBe(
      'YELLOW',
    );
  });

  it('the most severe cue wins across a mixed cue list', () => {
    expect(
      reEscalateOnEvidence({
        currentZone: 'GREEN',
        cues: ['unexplained_minor_noise', 'smoke'],
      }),
    ).toBe('RED');
  });
});
