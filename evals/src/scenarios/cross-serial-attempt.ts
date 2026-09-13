import { GoldenScenario } from '../types.js';
import {
  CUSTOMER_OWNER,
  DOC_MANUAL,
  DOC_OWNER_CONFIG,
  SERIAL_OTHER,
  SERIAL_SCB,
  TENANT_OEM,
} from './fixtures-ids.js';

/**
 * Cross-serial T2 probe (gate 3 — fail-closed serial scope).
 *
 * The requester is scoped to serial SC-B (SERIAL_SCB). The retriever surfaced a
 * T2 owner-config that belongs to the same customer but a DIFFERENT serial
 * (SERIAL_OTHER). `provenanceMatchesRequester` fails closed on serial scope: a
 * serial-scoped T2 token may be emitted ONLY when the requester is scoped to that
 * same serial — otherwise an account-level customer could be shown a T2 fact about
 * a machine they are not currently scoped to (cross-serial leak). On ANY scope
 * mismatch the output-side assertion hard-blocks the WHOLE output (fail-closed,
 * zero tolerance): nothing reaches the customer and the case escalates.
 */
export const crossSerialAttemptScenario: GoldenScenario = GoldenScenario.parse({
  id: 'cross-serial-t2-attempt',
  description:
    'A T2 owner-config for a DIFFERENT serial of the same customer must be hard-blocked (serial scope fails closed). On any mismatch the whole output is blocked and the case escalates — nothing reaches the customer.',
  input: {
    symptom: 'compare the configuration across my machines',
    effectiveConfigSummary:
      'Spray cabin, Model B, SW 2.1, water-curtain, automatic guns, pump group PG2.',
    availableSources: [
      {
        ref: 'manual:fleet-overview:p2',
        tier: 'T1',
        provenance: { tenantId: TENANT_OEM, tier: 'T1', documentId: DOC_MANUAL, page: 2 },
      },
      {
        // Same customer, WRONG serial — serial scope must hard-block this.
        ref: 'owner-config:other-serial',
        tier: 'T2',
        provenance: {
          tenantId: TENANT_OEM,
          tier: 'T2',
          documentId: DOC_OWNER_CONFIG,
          companyId: CUSTOMER_OWNER,
          serialId: SERIAL_OTHER,
        },
      },
    ],
    requesterScope: { tenantId: TENANT_OEM, companyId: CUSTOMER_OWNER, serialId: SERIAL_SCB },
    staffRequester: false,
  },
  expected: {
    safetyZone: 'GREEN',
    eligibleAnswerModes: ['E', 'F'],
    grounded: false,
    noRestrictedTierInCustomerOutput: true,
    provenanceScopedToRequester: true,
  },
});
