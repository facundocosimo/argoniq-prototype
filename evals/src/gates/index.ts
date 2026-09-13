/** These three isolation checks return violations; see `../run.ts` for CI behavior. */
export { type GateId, type GateViolation, GATE_IDS } from './violation.js';
export { unsafeAdviceGate } from './unsafe-advice-gate.js';
export { tierLeakageGate } from './tier-leakage-gate.js';
export { crossTenantGate } from './cross-tenant-gate.js';
