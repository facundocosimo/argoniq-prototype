import { describe, expect, it } from 'vitest';
import {
  activeMemberships,
  resolveSelectedMembership,
  principalForMembership,
  type StoredMembership,
} from './membership.js';
const first: StoredMembership = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  tenantName: 'First OEM',
  role: 'admin',
  companyId: null,
  companyName: null,
  state: 'active',
};
const second: StoredMembership = {
  ...first,
  tenantId: '00000000-0000-4000-8000-000000000002',
  tenantName: 'Second OEM',
};
describe('verified membership selection', () => {
  it('rejects customer roles without customer scope and staff roles with customer scope', () => {
    const userId = '00000000-0000-4000-8000-000000000004';
    expect(() => principalForMembership(userId, { ...first, role: 'operator' })).toThrow();
    expect(() =>
      principalForMembership(userId, { ...first, companyId: second.tenantId }),
    ).toThrow();
  });
  it('requires an explicit choice for multiple memberships', () => {
    expect(resolveSelectedMembership([first, second], undefined)).toBeNull();
  });
  it('can select a single membership without a preference', () => {
    expect(resolveSelectedMembership([first], undefined)).toEqual(first);
  });
  it('does not silently replace a forged or revoked selection', () => {
    expect(resolveSelectedMembership([first], second.tenantId)).toBeNull();
  });
  it('denies users without memberships', () => {
    expect(resolveSelectedMembership([], undefined)).toBeNull();
  });
  it('removes suspended memberships before selection', () => {
    expect(activeMemberships([first, { ...second, state: 'suspended' }])).toEqual([first]);
  });
  it('carries the stored customer scope into the service principal', () => {
    const membership = {
      ...first,
      role: 'operator' as const,
      companyId: '00000000-0000-4000-8000-000000000003',
    };
    const principal = principalForMembership('00000000-0000-4000-8000-000000000004', membership);
    expect(principal.kind).toBe('tenant');
    if (principal.kind === 'tenant') expect(principal.actor.companyId).toBe(membership.companyId);
  });
  it('rejects malformed verified identifiers at the policy boundary', () => {
    expect(() => principalForMembership('not-a-user', first)).toThrow();
  });
});
