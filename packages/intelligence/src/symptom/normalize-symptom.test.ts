import { describe, expect, it } from 'vitest';
import {
  type CanonicalSymptom,
  MachineFamilyId,
  SymptomId,
  TenantId,
  UNMAPPED_SYMPTOM,
} from '@argoniq/core-domain';
import { normalizeSymptom, type SymptomCandidate } from './normalize-symptom.js';

const TENANT = TenantId.parse('11111111-1111-4111-8111-111111111111');
const FAMILY = MachineFamilyId.parse('22222222-2222-4222-8222-222222222222');

function symptom(idSeed: string, key: string): CanonicalSymptom {
  return {
    id: SymptomId.parse(idSeed),
    tenantId: TENANT,
    familyId: FAMILY,
    key,
    path: 'leak.droplets.dosing_head',
    label: 'Droplets under the dosing head',
    contextQualifiers: [],
    status: 'active',
    version: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

const droplet = symptom('33333333-3333-4333-8333-333333333333', 'SYM-LEAK-DROPLET-DOSINGHEAD');
const floor = symptom('44444444-4444-4444-8444-444444444444', 'SYM-LEAK-FLOOR');

describe('normalizeSymptom — never force a confident wrong map ', () => {
  it('maps a single high-score candidate', () => {
    const result = normalizeSymptom({
      candidates: [{ symptom: droplet, score: 0.92 } satisfies SymptomCandidate],
      matchFloor: 0.6,
      marginFloor: 0.05,
    });
    expect(result.kind).toBe('mapped');
    if (result.kind === 'mapped') expect(result.symptom.key).toBe('SYM-LEAK-DROPLET-DOSINGHEAD');
  });

  it('returns UNMAPPED when there are no candidates', () => {
    const result = normalizeSymptom({ candidates: [] });
    expect(result.kind).toBe('unmapped');
    if (result.kind === 'unmapped') {
      expect(result.reason).toBe('no_candidate');
      expect(result.symptom).toBe(UNMAPPED_SYMPTOM);
    }
  });

  it('returns UNMAPPED when the top score is below the match floor', () => {
    const result = normalizeSymptom({
      candidates: [{ symptom: droplet, score: 0.4 }],
    });
    expect(result.kind).toBe('unmapped');
    if (result.kind === 'unmapped') expect(result.reason).toBe('below_floor');
  });

  it('returns UNMAPPED (ambiguous multi-map) when the top-1/top-2 margin is thin', () => {
    const result = normalizeSymptom({
      candidates: [
        { symptom: droplet, score: 0.71 },
        { symptom: floor, score: 0.69 },
      ],
    });
    expect(result.kind).toBe('unmapped');
    if (result.kind === 'unmapped') {
      expect(result.reason).toBe('ambiguous');
      // The clarify step needs the candidates, best-first.
      expect(result.candidates[0]?.symptom.key).toBe('SYM-LEAK-DROPLET-DOSINGHEAD');
    }
  });

  it('maps the clear leader when the margin is comfortable', () => {
    const result = normalizeSymptom({
      candidates: [
        { symptom: droplet, score: 0.85 },
        { symptom: floor, score: 0.3 },
      ],
    });
    expect(result.kind).toBe('mapped');
  });
});
