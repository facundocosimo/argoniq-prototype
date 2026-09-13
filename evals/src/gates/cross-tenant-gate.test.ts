import { describe, expect, it } from 'vitest';
import { crossTenantGate } from './cross-tenant-gate.js';
import { crossTenantAttemptScenario, greenManualLookupScenario } from '../scenarios/index.js';
import { makeFact, makeOutput, makeResult } from '../test-support.js';
import {
  CUSTOMER_OTHER,
  CUSTOMER_OWNER,
  DOC_MANUAL,
  DOC_OWNER_CONFIG,
  SERIAL_SCB,
  TENANT_OEM,
  TENANT_OTHER,
} from '../scenarios/fixtures-ids.js';

describe('crossTenantGate ( gate 3 — cross-tenant/customer isolation = 0)', () => {
  it('catches a fact whose provenance tenant does not match the requester', () => {
    const wrongTenantFact = makeFact('manual:other-tenant:p7', {
      tenantId: TENANT_OTHER,
      tier: 'T1',
      documentId: DOC_MANUAL,
      page: 7,
    });
    const result = makeResult(
      crossTenantAttemptScenario,
      makeOutput({ answerMode: 'A', emittedFacts: [wrongTenantFact] }),
    );

    const violations = crossTenantGate([result]);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.gate).toBe('cross-tenant');
  });

  it('catches a T2 fact scoped to a different customer in the same tenant', () => {
    const wrongCustomerFact = makeFact('owner-config:other-customer', {
      tenantId: TENANT_OEM,
      tier: 'T2',
      documentId: DOC_OWNER_CONFIG,
      companyId: CUSTOMER_OTHER,
      serialId: SERIAL_SCB,
    });
    const result = makeResult(
      crossTenantAttemptScenario,
      makeOutput({ answerMode: 'A', emittedFacts: [wrongCustomerFact] }),
    );

    expect(crossTenantGate([result])).toHaveLength(1);
  });

  it('passes a clean answer whose provenance matches the requester (tenant + T2 scope)', () => {
    const ownerT1 = makeFact('manual:alarms:E42:p88', {
      tenantId: TENANT_OEM,
      tier: 'T1',
      documentId: DOC_MANUAL,
      page: 88,
    });
    const ownerT2 = makeFact('owner-config:SC-B-2022-019', {
      tenantId: TENANT_OEM,
      tier: 'T2',
      documentId: DOC_OWNER_CONFIG,
      companyId: CUSTOMER_OWNER,
      serialId: SERIAL_SCB,
    });
    const result = makeResult(
      greenManualLookupScenario,
      makeOutput({ answerMode: 'A', emittedFacts: [ownerT1, ownerT2] }),
    );

    expect(crossTenantGate([result])).toHaveLength(0);
  });
});
