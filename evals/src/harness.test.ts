import { describe, expect, it } from 'vitest';
import { runScenarios } from './harness.js';
import { greenManualLookupScenario, redEnergyBearingScenario } from './scenarios/index.js';
import { makeFact, makeOutput, scriptedPipeline } from './test-support.js';
import {
  CUSTOMER_OWNER,
  DOC_MANUAL,
  DOC_OWNER_CONFIG,
  DOC_SB_PG2,
  SERIAL_SCB,
  TENANT_OEM,
} from './scenarios/fixtures-ids.js';

describe('runScenarios — harness aggregation', () => {
  it('passes with zero violations when every output is clean and correctly scoped', async () => {
    const pipeline = scriptedPipeline(() =>
      makeOutput({
        answerMode: 'A',
        safetyZone: 'GREEN',
        emittedFacts: [
          makeFact('manual:alarms:E42:p88', {
            tenantId: TENANT_OEM,
            tier: 'T1',
            documentId: DOC_MANUAL,
            page: 88,
          }),
          makeFact('owner-config:SC-B-2022-019', {
            tenantId: TENANT_OEM,
            tier: 'T2',
            documentId: DOC_OWNER_CONFIG,
            companyId: CUSTOMER_OWNER,
            serialId: SERIAL_SCB,
          }),
        ],
      }),
    );

    const report = await runScenarios(pipeline, { scenarios: [greenManualLookupScenario] });

    expect(report.passed).toBe(true);
    expect(report.totalViolations).toBe(0);
    expect(report.gates.every((g) => g.passed)).toBe(true);
  });

  it('fails (and never averages) when a single scenario trips multiple gates', async () => {
    // A worst-case output: RED procedure to a customer (gate 1), a T3 citation
    // (gate 2), AND that same T3 fact carries valid tenant provenance, so only
    // gates 1 and 2 fire — proving each gate is independent and counted raw.
    const pipeline = scriptedPipeline(() =>
      makeOutput({
        answerMode: 'B',
        safetyZone: 'RED',
        procedureEmitted: true,
        emittedFacts: [
          makeFact('service-bulletin:SB-PG2', {
            tenantId: TENANT_OEM,
            tier: 'T3',
            documentId: DOC_SB_PG2,
          }),
        ],
      }),
    );

    const report = await runScenarios(pipeline, { scenarios: [redEnergyBearingScenario] });

    expect(report.passed).toBe(false);
    const unsafe = report.gates.find((g) => g.gate === 'unsafe-advice');
    const leak = report.gates.find((g) => g.gate === 'tier-leakage');
    const xtenant = report.gates.find((g) => g.gate === 'cross-tenant');
    expect(unsafe?.passed).toBe(false);
    expect(leak?.passed).toBe(false);
    expect(xtenant?.passed).toBe(true);
    // Raw counts, summed — never averaged.
    expect(report.totalViolations).toBe(2);
  });

  it('runs the full golden set against a clean scripted pipeline with no violations', async () => {
    // Echo each scenario's own correctly-scoped sources, never emitting T3/T4 or
    // a procedure — the structural guarantee the real pipeline must also meet.
    const pipeline = scriptedPipeline((input) =>
      makeOutput({
        answerMode: 'A',
        safetyZone: 'GREEN',
        emittedFacts: input.availableSources
          .filter((s) => s.tier === 'T1' || s.tier === 'T2')
          .filter((s) => s.provenance.tenantId === input.requesterScope.tenantId)
          .filter(
            (s) => s.tier !== 'T2' || s.provenance.companyId === input.requesterScope.companyId,
          )
          // A serial-scoped T2 token is only emitted when the requester serial matches
          // (fail-closed serial scope — the cross-serial probe must not leak).
          .filter(
            (s) =>
              s.tier !== 'T2' ||
              s.provenance.serialId === undefined ||
              s.provenance.serialId === input.requesterScope.serialId,
          )
          .map((s) => makeFact(s.ref, s.provenance)),
      }),
    );

    const report = await runScenarios(pipeline);

    expect(report.results.length).toBeGreaterThanOrEqual(5);
    expect(report.passed).toBe(true);
    expect(report.totalViolations).toBe(0);
  });
});
