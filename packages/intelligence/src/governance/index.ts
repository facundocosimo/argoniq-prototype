/**
 * Governance layer (Layer 19) — the leak/isolation choke points.
 *
 *  - `buildCustomerChannelContext` physically excludes T3/T4 (gate 2 is structural).
 *  - `groundingGate` returns a downgrade Result when a customer claim is uncited.
 *  - `assertOutputProvenance` hard-blocks cross-tenant/scope emission (gate 3, throws).
 */
export * from './customer-channel.js';
export * from './grounding-gate.js';
export * from './assert-output-provenance.js';
