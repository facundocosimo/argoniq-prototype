import { GoldenScenario } from '../types.js';
import {
  CUSTOMER_OWNER,
  DOC_MANUAL,
  DOC_OWNER_CONFIG,
  DOC_SB_PG2,
  SERIAL_SCB,
  TENANT_OEM,
} from './fixtures-ids.js';

/**
 * Fictional coating-quality cluster used to test escalation and tier filtering.
 *
 * An open fleet cluster may affect ranking, while its staff-only source must not
 * appear in customer output. All names and values in this scenario are invented.
 */
export const coatingQualityClusterScenario: GoldenScenario = GoldenScenario.parse({
  id: 'fictional-coating-quality-cluster',
  description:
    'A fictional coating-quality report matches an open cluster. The answer stays grounded, escalates, and keeps the staff-only source out of customer output.',
  input: {
    symptom: 'coating looks porous / pin-holes on parts since the last batch',
    effectiveConfigSummary:
      'Spray cabin, Model B, SW 2.1, water-curtain, automatic guns, pump group PG2.',
    availableSources: [
      {
        ref: 'manual:coating-quality:p42',
        tier: 'T1',
        provenance: { tenantId: TENANT_OEM, tier: 'T1', documentId: DOC_MANUAL, page: 42 },
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
      {
        // T3 reasoning source — shapes ranking, must stay in the internal channel.
        ref: 'service-bulletin:SB-PG2',
        tier: 'T3',
        provenance: { tenantId: TENANT_OEM, tier: 'T3', documentId: DOC_SB_PG2 },
      },
    ],
    requesterScope: { tenantId: TENANT_OEM, companyId: CUSTOMER_OWNER, serialId: SERIAL_SCB },
    staffRequester: false,
    // The invented causes intentionally have no clear leader, and the cluster is open.
    requestKind: 'diagnostic',
    candidateCauses: [
      { key: 'nozzle_alignment', prior: 0.28 },
      { key: 'material_viscosity', prior: 0.2 },
      { key: 'surface_preparation', prior: 0.18 },
      { key: 'pump_variation', prior: 0.15 },
      { key: 'incorrect_profile', prior: 0.12 },
      { key: 'unknown_disturbance', prior: 0.07 },
    ],
    openFleetCluster: true,
  },
  expected: {
    safetyZone: 'YELLOW',
    eligibleAnswerModes: ['C', 'E'],
    grounded: true,
    noRestrictedTierInCustomerOutput: true,
    provenanceScopedToRequester: true,
  },
});
