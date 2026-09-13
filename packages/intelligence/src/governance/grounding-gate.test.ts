import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '@argoniq/contracts';
import { type CustomerClaim, groundingGate } from './grounding-gate.js';

describe('groundingGate — downgrade on an uncited customer claim (Layer 3)', () => {
  it('passes when every technical claim binds to a T1/T2 citation', () => {
    const claims: CustomerClaim[] = [
      {
        claimId: 'c1',
        isTechnical: true,
        citations: [{ kind: 'source', sourceId: 't1-manual', tier: 'T1' }],
      },
    ];
    const result = groundingGate(claims);
    expect(isOk(result)).toBe(true);
  });

  it('passes when a claim binds to an approved playbook step', () => {
    const result = groundingGate([
      {
        claimId: 'c1',
        isTechnical: true,
        citations: [{ kind: 'approvedPlaybookStep', stepKey: 'q2' }],
      },
    ]);
    expect(isOk(result)).toBe(true);
  });

  it('downgrades when a technical claim has no citation', () => {
    const result = groundingGate([{ claimId: 'c1', isTechnical: true, citations: [] }]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('GROUNDING_FAILED');
      expect(result.error.unboundClaimIds).toContain('c1');
    }
  });

  it('rejects a claim bound only to a T3 source (T3 is not customer-citable)', () => {
    const result = groundingGate([
      {
        claimId: 'c1',
        isTechnical: true,
        citations: [{ kind: 'source', sourceId: 't3-sb', tier: 'T3' }],
      },
    ]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.unboundClaimIds).toContain('c1');
  });

  it('routes to Mode E when most technical claims are unbound, Mode C when few', () => {
    // 2 of 3 technical claims unbound → majority → escalate (E).
    const mostlyUnbound = groundingGate([
      { claimId: 'a', isTechnical: true, citations: [] },
      { claimId: 'b', isTechnical: true, citations: [] },
      {
        claimId: 'c',
        isTechnical: true,
        citations: [{ kind: 'approvedPlaybookStep', stepKey: 'q1' }],
      },
    ]);
    expect(isErr(mostlyUnbound)).toBe(true);
    if (isErr(mostlyUnbound)) expect(mostlyUnbound.error.downgradeTo).toBe('E');

    // 1 of 3 unbound → minority → hedge (C).
    const oneUnbound = groundingGate([
      { claimId: 'a', isTechnical: true, citations: [] },
      {
        claimId: 'b',
        isTechnical: true,
        citations: [{ kind: 'approvedPlaybookStep', stepKey: 'q1' }],
      },
      {
        claimId: 'c',
        isTechnical: true,
        citations: [{ kind: 'approvedPlaybookStep', stepKey: 'q2' }],
      },
    ]);
    expect(isErr(oneUnbound)).toBe(true);
    if (isErr(oneUnbound)) expect(oneUnbound.error.downgradeTo).toBe('C');
  });

  it('ignores non-technical claims (no citation required)', () => {
    const result = groundingGate([{ claimId: 'greeting', isTechnical: false, citations: [] }]);
    expect(isOk(result)).toBe(true);
  });
});
