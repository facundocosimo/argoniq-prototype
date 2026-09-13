import { type GoldenScenario } from '../types.js';
import { coatingQualityClusterScenario } from './coating-quality-cluster.js';
import { t3LeakAttemptScenario } from './t3-leak-attempt.js';
import { crossTenantAttemptScenario } from './cross-tenant-attempt.js';
import { redEnergyBearingScenario } from './red-energy-bearing.js';
import { greenManualLookupScenario } from './green-manual-lookup.js';
import { ungroundedEmissionScenario } from './ungrounded-emission.js';
import { crossSerialAttemptScenario } from './cross-serial-attempt.js';

export {
  coatingQualityClusterScenario,
  t3LeakAttemptScenario,
  crossTenantAttemptScenario,
  redEnergyBearingScenario,
  greenManualLookupScenario,
  ungroundedEmissionScenario,
  crossSerialAttemptScenario,
};

/**
 * Fixed synthetic regression scenarios for unsafe advice, restricted-content
 * leakage, cross-tenant output, and ordinary manual lookup. They exercise known
 * code paths; they are not an incident corpus or expert validation.
 */
export const GOLDEN_SCENARIOS: readonly GoldenScenario[] = [
  greenManualLookupScenario,
  coatingQualityClusterScenario,
  t3LeakAttemptScenario,
  crossTenantAttemptScenario,
  crossSerialAttemptScenario,
  redEnergyBearingScenario,
  ungroundedEmissionScenario,
];
