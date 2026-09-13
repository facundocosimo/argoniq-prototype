import { describe, expect, it } from 'vitest';
import { DEFAULT_ZONE } from '@argoniq/core-domain';
import { classifyZone, reconcileSuggestedZone, type SafetyContext } from './classify-zone.js';

/** Empty context = a novel/unclassified check → must default to RED. */
const empty: SafetyContext = {
  storedEnergy: false,
  pressurized: false,
  hotSurface: false,
  suspendedLoad: false,
  liveElectrical: false,
  safetyInterlock: false,
  movingParts: false,
  warrantyOrControlChange: false,
  approvedLowEnergyObservation: false,
  approvedInformationalLookup: false,
};

describe('classifyZone — deterministic  rule', () => {
  it('defaults to RED for a novel/unclassified check ', () => {
    expect(classifyZone(empty)).toBe('RED');
    expect(DEFAULT_ZONE).toBe('RED');
  });

  it('every energy-bearing flag forces RED for remote chat', () => {
    const energyFlags = [
      'storedEnergy',
      'pressurized',
      'hotSurface',
      'suspendedLoad',
      'liveElectrical',
      'safetyInterlock',
      'movingParts',
      'warrantyOrControlChange',
    ] as const;
    for (const flag of energyFlags) {
      expect(classifyZone({ ...empty, [flag]: true })).toBe('RED');
    }
  });

  it('a pressurized but powered-off pump group is still RED ( PG2 case)', () => {
    expect(classifyZone({ ...empty, pressurized: true })).toBe('RED');
  });

  it('energy-bearing wins even if an approved-lookup flag is also set', () => {
    expect(
      classifyZone({ ...empty, liveElectrical: true, approvedInformationalLookup: true }),
    ).toBe('RED');
  });

  it('GREEN only for an explicitly-approved informational lookup', () => {
    expect(classifyZone({ ...empty, approvedInformationalLookup: true })).toBe('GREEN');
  });

  it('YELLOW only for an explicitly-approved low-energy observation', () => {
    expect(classifyZone({ ...empty, approvedLowEnergyObservation: true })).toBe('YELLOW');
  });
});

describe('reconcileSuggestedZone — the LLM may only ever raise the zone', () => {
  it('a model RED suggestion raises a rule GREEN', () => {
    expect(reconcileSuggestedZone('GREEN', 'RED')).toBe('RED');
  });

  it('a model GREEN suggestion can never lower a rule RED', () => {
    expect(reconcileSuggestedZone('RED', 'GREEN')).toBe('RED');
  });

  it('a model YELLOW suggestion can never lower a rule RED', () => {
    expect(reconcileSuggestedZone('RED', 'YELLOW')).toBe('RED');
  });
});
