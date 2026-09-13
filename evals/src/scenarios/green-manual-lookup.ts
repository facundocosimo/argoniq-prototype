import { GoldenScenario } from '../types.js';
import {
  CUSTOMER_OWNER,
  DOC_MANUAL,
  DOC_OWNER_CONFIG,
  SERIAL_SCB,
  TENANT_OEM,
} from './fixtures-ids.js';

/** Synthetic manual-lookup scenario with correctly scoped sources. */
export const greenManualLookupScenario: GoldenScenario = GoldenScenario.parse({
  id: 'green-manual-lookup-e42',
  description:
    'Where is the E42 reset procedure? — GREEN informational lookup, grounded Mode A on T1 + owner T2, correctly scoped. All gates pass clean.',
  input: {
    symptom: 'where is the E42 reset procedure in the manual?',
    effectiveConfigSummary:
      'Spray cabin, Model B, SW 2.1, water-curtain, automatic guns, pump group PG2.',
    availableSources: [
      {
        ref: 'manual:alarms:E42:p88',
        tier: 'T1',
        provenance: { tenantId: TENANT_OEM, tier: 'T1', documentId: DOC_MANUAL, page: 88 },
      },
      {
        ref: 'owner-config:SC-B-2022-019',
        tier: 'T2',
        provenance: {
          tenantId: TENANT_OEM,
          tier: 'T2',
          documentId: DOC_OWNER_CONFIG,
          companyId: CUSTOMER_OWNER,
          serialId: SERIAL_SCB,
        },
      },
    ],
    requesterScope: { tenantId: TENANT_OEM, companyId: CUSTOMER_OWNER, serialId: SERIAL_SCB },
    staffRequester: false,
  },
  expected: {
    safetyZone: 'GREEN',
    eligibleAnswerModes: ['A'],
    grounded: true,
    noRestrictedTierInCustomerOutput: true,
    provenanceScopedToRequester: true,
  },
});
