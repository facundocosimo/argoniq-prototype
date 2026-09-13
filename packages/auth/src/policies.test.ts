import { subject } from '@casl/ability';
import { type AuditEvent } from '@argoniq/observability';
import { describe, expect, it } from 'vitest';
import { Actor } from './actor.js';
import { defineAbilityFor } from './ability.js';
import { canSurfaceTierToActor, canViewInternalKnowledge, createPolicyEngine } from './policies.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const CUSTOMER_1 = '33333333-3333-4333-8333-333333333333';
const CUSTOMER_2 = '44444444-4444-4444-8444-444444444444';

const technician = Actor.parse({ userId: USER, tenantId: TENANT, role: 'support_technician' });
const manager = Actor.parse({ userId: USER, tenantId: TENANT, role: 'support_manager' });
const operator = Actor.parse({
  userId: USER,
  tenantId: TENANT,
  role: 'operator',
  companyId: CUSTOMER_1,
});

describe('tier visibility (gate 2)', () => {
  it('companies can never read T3/T4 documents', () => {
    const ability = defineAbilityFor(operator);
    expect(ability.can('read', subject('Document', { tier: 'T3' }))).toBe(false);
    expect(ability.can('read', subject('Document', { tier: 'T4' }))).toBe(false);
  });

  it('companies read tenant-wide T1 and only their own T2', () => {
    const ability = defineAbilityFor(operator);
    expect(ability.can('read', subject('Document', { tier: 'T1' }))).toBe(true);
    expect(ability.can('read', subject('Document', { tier: 'T2', companyId: CUSTOMER_1 }))).toBe(
      true,
    );
    expect(ability.can('read', subject('Document', { tier: 'T2', companyId: CUSTOMER_2 }))).toBe(
      false,
    );
  });

  it('technicians see up to T3 but not T4; managers see T4', () => {
    expect(canSurfaceTierToActor(technician, 'T3')).toBe(true);
    expect(canSurfaceTierToActor(technician, 'T4')).toBe(false);
    expect(canSurfaceTierToActor(manager, 'T4')).toBe(true);
  });

  it('only staff may reason over internal (T3) knowledge', () => {
    expect(canViewInternalKnowledge(technician)).toBe(true);
    expect(canViewInternalKnowledge(operator)).toBe(false);
  });
});

describe('createPolicyEngine — default-deny + assertCan', () => {
  it('throws ForbiddenError when denied and audits the decision', () => {
    const recorded: string[] = [];
    const auditor = {
      record: (event: AuditEvent): void => {
        if (event.kind === 'access') recorded.push(`${event.action}:${event.decision}`);
      },
    };
    const policy = createPolicyEngine(operator, auditor);

    expect(() => policy.assertCan('read', 'Document', { tier: 'T3' })).toThrow();
    expect(policy.can('read', 'Document', { tier: 'T1' })).toBe(true);
    expect(recorded).toContain('Document.read:deny');
  });

  it('a customer cannot create a case for another customer', () => {
    const policy = createPolicyEngine(operator);
    expect(policy.can('create', 'Case', { companyId: CUSTOMER_1 })).toBe(true);
    expect(policy.can('create', 'Case', { companyId: CUSTOMER_2 })).toBe(false);
  });

  it('a customer may tag (update) their own serial but not another customer’s', () => {
    const policy = createPolicyEngine(operator);
    expect(policy.can('update', 'Serial', { companyId: CUSTOMER_1 })).toBe(true);
    expect(policy.can('update', 'Serial', { companyId: CUSTOMER_2 })).toBe(false);
    // The narrow tag rule must NOT widen the OEM management path, which asserts
    // `update Serial` with only an id (no companyId) — companies stay denied there.
    expect(policy.can('update', 'Serial', { id: 'some-serial-id' })).toBe(false);
  });

  it('a support technician cannot update a serial; a manager (manage all) can', () => {
    expect(createPolicyEngine(technician).can('update', 'Serial', { id: 'x' })).toBe(false);
    expect(createPolicyEngine(manager).can('update', 'Serial', { id: 'x' })).toBe(true);
  });
});
