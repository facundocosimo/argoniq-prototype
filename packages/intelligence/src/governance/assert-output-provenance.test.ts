import { describe, expect, it } from 'vitest';
import { CompanyId, TenantId } from '@argoniq/core-domain';
import { type ProvenanceToken } from '@argoniq/contracts';
import { TenantIsolationError } from '@argoniq/observability';
import { assertOutputProvenance, type EmittedToken } from './assert-output-provenance.js';

const TENANT_A = TenantId.parse('11111111-1111-4111-8111-111111111111');
const TENANT_B = TenantId.parse('22222222-2222-4222-8222-222222222222');
const CUSTOMER_1 = CompanyId.parse('33333333-3333-4333-8333-333333333333');
const CUSTOMER_2 = CompanyId.parse('44444444-4444-4444-8444-444444444444');

function token(id: string, provenance: ProvenanceToken): EmittedToken {
  return { tokenId: id, provenance };
}

describe('assertOutputProvenance —  gate 3 (output-side isolation)', () => {
  it('passes when every emitted token matches the requester tenant', () => {
    expect(() =>
      assertOutputProvenance([token('t1', { tenantId: TENANT_A, tier: 'T1' })], {
        tenantId: TENANT_A,
      }),
    ).not.toThrow();
  });

  it('hard-blocks a cross-tenant token with TenantIsolationError', () => {
    expect(() =>
      assertOutputProvenance([token('leak', { tenantId: TENANT_B, tier: 'T1' })], {
        tenantId: TENANT_A,
      }),
    ).toThrow(TenantIsolationError);
  });

  it('hard-blocks a cross-customer T2 token even within the same tenant', () => {
    expect(() =>
      assertOutputProvenance(
        [token('t2', { tenantId: TENANT_A, tier: 'T2', companyId: CUSTOMER_2 })],
        { tenantId: TENANT_A, companyId: CUSTOMER_1 },
      ),
    ).toThrow(TenantIsolationError);
  });

  it('blocks on the first mismatch in a list and never exposes its message', () => {
    try {
      assertOutputProvenance(
        [
          token('ok', { tenantId: TENANT_A, tier: 'T1' }),
          token('bad', { tenantId: TENANT_B, tier: 'T1' }),
        ],
        { tenantId: TENANT_A },
      );
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TenantIsolationError);
      if (error instanceof TenantIsolationError) {
        expect(error.expose).toBe(false);
        expect(error.details?.tokenId).toBe('bad');
      }
    }
  });
});
