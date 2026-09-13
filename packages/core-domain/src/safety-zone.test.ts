import { describe, expect, it } from 'vitest';
import { DEFAULT_ZONE, canEmitProcedureRemotely, escalateZone } from './safety-zone.js';

describe('safety zone', () => {
  it('defaults to RED on uncertainty ', () => {
    expect(DEFAULT_ZONE).toBe('RED');
  });

  it('re-escalation is monotonic — evidence can only raise the zone', () => {
    expect(escalateZone('GREEN', 'RED')).toBe('RED');
    expect(escalateZone('YELLOW', 'GREEN')).toBe('YELLOW');
    expect(escalateZone('RED', 'YELLOW')).toBe('RED');
  });

  it('never emits a RED procedure remotely, even with verified preconditions', () => {
    expect(canEmitProcedureRemotely('RED', true)).toBe(false);
    expect(canEmitProcedureRemotely('YELLOW', false)).toBe(false);
    expect(canEmitProcedureRemotely('YELLOW', true)).toBe(true);
    expect(canEmitProcedureRemotely('GREEN', false)).toBe(true);
  });
});
