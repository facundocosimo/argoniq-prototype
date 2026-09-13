import { describe, expect, it } from 'vitest';
import { CompanyId, SerialId, TenantId } from '@argoniq/core-domain';
import { type ProvenanceToken, provenanceMatchesRequester } from './provenance.js';

const TENANT_A = TenantId.parse('11111111-1111-4111-8111-111111111111');
const TENANT_B = TenantId.parse('22222222-2222-4222-8222-222222222222');
const CUSTOMER_1 = CompanyId.parse('33333333-3333-4333-8333-333333333333');
const CUSTOMER_2 = CompanyId.parse('44444444-4444-4444-8444-444444444444');
const SERIAL_1 = SerialId.parse('55555555-5555-4555-8555-555555555555');

describe('provenanceMatchesRequester ( gate 3)', () => {
  it('blocks any cross-tenant token', () => {
    const token: ProvenanceToken = { tenantId: TENANT_B, tier: 'T1' };
    expect(provenanceMatchesRequester(token, { tenantId: TENANT_A })).toBe(false);
  });

  it('allows tenant-wide T1 within the same tenant', () => {
    const token: ProvenanceToken = { tenantId: TENANT_A, tier: 'T1' };
    expect(provenanceMatchesRequester(token, { tenantId: TENANT_A })).toBe(true);
  });

  it('scopes T2 to the requester customer', () => {
    const token: ProvenanceToken = { tenantId: TENANT_A, tier: 'T2', companyId: CUSTOMER_1 };
    expect(provenanceMatchesRequester(token, { tenantId: TENANT_A, companyId: CUSTOMER_1 })).toBe(
      true,
    );
    expect(provenanceMatchesRequester(token, { tenantId: TENANT_A, companyId: CUSTOMER_2 })).toBe(
      false,
    );
  });

  it('denies a malformed T2 token with no customer scope', () => {
    const token: ProvenanceToken = { tenantId: TENANT_A, tier: 'T2' };
    expect(provenanceMatchesRequester(token, { tenantId: TENANT_A, companyId: CUSTOMER_1 })).toBe(
      false,
    );
  });

  it('enforces serial scope when the token is serial-scoped', () => {
    const token: ProvenanceToken = {
      tenantId: TENANT_A,
      tier: 'T2',
      companyId: CUSTOMER_1,
      serialId: SERIAL_1,
    };
    const otherSerial = SerialId.parse('66666666-6666-4666-8666-666666666666');
    expect(
      provenanceMatchesRequester(token, {
        tenantId: TENANT_A,
        companyId: CUSTOMER_1,
        serialId: otherSerial,
      }),
    ).toBe(false);
  });

  it('fails closed: a serial-scoped token is denied when the requester has no serial scope', () => {
    const token: ProvenanceToken = {
      tenantId: TENANT_A,
      tier: 'T2',
      companyId: CUSTOMER_1,
      serialId: SERIAL_1,
    };
    // Account-level customer (no serialId) must NOT receive another serial's T2 fact.
    expect(provenanceMatchesRequester(token, { tenantId: TENANT_A, companyId: CUSTOMER_1 })).toBe(
      false,
    );
  });
});
