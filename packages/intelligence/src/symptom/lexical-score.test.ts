import { describe, expect, it } from 'vitest';
import { LEXICAL_HIT_FLOOR, type ScorableSymptom, scoreSymptom } from './lexical-score.js';

const VIBRATION: ScorableSymptom = {
  path: 'motion.vibration.front_roller',
  label: 'Unusual vibration at the front roller',
  contextQualifiers: ['during_cycle'],
};
const SURFACE_MARKS: ScorableSymptom = {
  path: 'quality.surface_marks.finished_panel',
  label: 'Surface marks across finished panels',
};
const HIGH_TEMPERATURE: ScorableSymptom = {
  path: 'temperature.drive_cabinet.high',
  label: 'High temperature reading at the drive cabinet',
};

describe('scoreSymptom — deterministic lexical ranking', () => {
  it('matches a distinctive keyword across word forms (vibrating → vibration)', () => {
    expect(scoreSymptom('the front roller is vibrating', VIBRATION)).toBeGreaterThanOrEqual(
      LEXICAL_HIT_FLOOR,
    );
  });

  it('ranks the right symptom first for a vibration report', () => {
    const text = 'the front roller started vibrating during the last cycle';
    const vibration = scoreSymptom(text, VIBRATION);
    expect(vibration).toBeGreaterThan(scoreSymptom(text, SURFACE_MARKS));
    expect(vibration).toBeGreaterThan(scoreSymptom(text, HIGH_TEMPERATURE));
  });

  it('matches surface-mark wording', () => {
    expect(
      scoreSymptom('I see marks across the finished panels', SURFACE_MARKS),
    ).toBeGreaterThanOrEqual(LEXICAL_HIT_FLOOR);
  });

  it('matches high-temperature wording', () => {
    expect(
      scoreSymptom('temperature is high in the drive cabinet', HIGH_TEMPERATURE),
    ).toBeGreaterThanOrEqual(LEXICAL_HIT_FLOOR);
  });

  it('scores unrelated wording at zero (routes to clarify, never over-maps)', () => {
    expect(scoreSymptom('the door handle is loose', VIBRATION)).toBe(0);
    expect(scoreSymptom('', VIBRATION)).toBe(0);
  });
});
