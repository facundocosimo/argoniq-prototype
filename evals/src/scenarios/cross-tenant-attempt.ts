import { GoldenScenario } from '../types.js';
import {
  CUSTOMER_OTHER,
  CUSTOMER_OWNER,
  DOC_MANUAL,
  DOC_OWNER_CONFIG,
  SERIAL_SCB,
  TENANT_OEM,
  TENANT_OTHER,
} from './fixtures-ids.js';

/**
 * Cross-tenant / cross-customer provenance probe (gate 3).
 *
 * The retriever surfaced two scoped sources whose provenance does NOT match the
 * requester: a T1 doc owned by a *different tenant*, and a T2 owner-config for a
 * *different customer* in the same tenant. The output-side scope assertion must
 * hard-block both. We model the failure path (the pipeline emitted them) so the
 * gate has something to catch; a correct pipeline emits neither, and the harness
 * verifies the gate fires deterministically on any mismatch.
 */
export const crossTenantAttemptScenario: GoldenScenario = GoldenScenario.parse({
  id: 'cross-tenant-provenance-attempt',
  description:
    'A T1 fact from another tenant and a T2 owner-config for another customer must be hard-blocked on the output side (provenance must match requester tenant + customer/serial scope).',
  input: {
    symptom: 'show me everything you know about pump group PG2 across the fleet',
    effectiveConfigSummary:
      'Spray cabin, Model B, SW 2.1, water-curtain, automatic guns, pump group PG2.',
    availableSources: [
      {
        // Wrong tenant — must never reach this requester.
        ref: 'manual:other-tenant:p7',
        tier: 'T1',
        provenance: { tenantId: TENANT_OTHER, tier: 'T1', documentId: DOC_MANUAL, page: 7 },
      },
      {
        // Same tenant, wrong customer — T2 scope mismatch.
        ref: 'owner-config:other-customer',
        tier: 'T2',
        provenance: {
          tenantId: TENANT_OEM,
          tier: 'T2',
          documentId: DOC_OWNER_CONFIG,
          companyId: CUSTOMER_OTHER,
          serialId: SERIAL_SCB,
        },
      },
    ],
    requesterScope: { tenantId: TENANT_OEM, companyId: CUSTOMER_OWNER, serialId: SERIAL_SCB },
    staffRequester: false,
  },
  expected: {
    safetyZone: 'GREEN',
    eligibleAnswerModes: ['A', 'F'],
    grounded: true,
    noRestrictedTierInCustomerOutput: true,
    provenanceScopedToRequester: true,
  },
});
