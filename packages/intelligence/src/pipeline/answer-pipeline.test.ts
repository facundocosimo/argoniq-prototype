import { describe, expect, it } from 'vitest';
import { CompanyId, DocumentId, SerialId, TenantId } from '@argoniq/core-domain';
import { type ProvenanceToken } from '@argoniq/contracts';
import { FakeLlm } from '../llm/fake-llm.js';
import { type CauseCandidate } from '../diagnosis/rank-causes.js';
import { type RetrievedSource, runAnswerPipeline } from './answer-pipeline.js';

type PipelineInput = Parameters<typeof runAnswerPipeline>[0];

/**
 * Pipeline unit tests. The three zero-tolerance
 * gates are asserted directly on the pipeline output: T3/T4 never reaches the
 * customer channel (gate 2), a scope mismatch hard-blocks (gate 3), and RED never
 * emits a procedure (gate 1). Routing branches (A/B/C/E/F) are pinned to the
 * disposition. The LLM is `FakeLlm` — no network, deterministic.
 */

const TENANT = TenantId.parse('11111111-1111-4111-8111-111111111111');
const TENANT_OTHER = TenantId.parse('22222222-2222-4222-8222-222222222222');
const CUSTOMER = CompanyId.parse('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const SERIAL = SerialId.parse('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
const DOC_T1 = DocumentId.parse('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
const DOC_T2 = DocumentId.parse('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
const DOC_T3 = DocumentId.parse('ffffffff-ffff-4fff-8fff-ffffffffffff');

const SCOPE = { tenantId: TENANT, companyId: CUSTOMER, serialId: SERIAL };

const t1Provenance: ProvenanceToken = {
  tenantId: TENANT,
  tier: 'T1',
  documentId: DOC_T1,
  page: 12,
};
const t2Provenance: ProvenanceToken = {
  tenantId: TENANT,
  tier: 'T2',
  documentId: DOC_T2,
  companyId: CUSTOMER,
  serialId: SERIAL,
};
const t3Provenance: ProvenanceToken = { tenantId: TENANT, tier: 'T3', documentId: DOC_T3 };

const T1_SOURCE: RetrievedSource = {
  ref: 'manual:p12',
  tier: 'T1',
  text: 'T1-MANUAL-TEXT',
  forbiddenForCustomerFacing: false,
  provenance: t1Provenance,
};
const T3_SOURCE: RetrievedSource = {
  ref: 'bulletin:SB-1',
  tier: 'T3',
  text: 'T3-SECRET-BULLETIN',
  forbiddenForCustomerFacing: false,
  provenance: t3Provenance,
};
const t4Provenance: ProvenanceToken = { tenantId: TENANT, tier: 'T4', documentId: DOC_T3 };
const T4_SOURCE: RetrievedSource = {
  ref: 'restricted:firmware-key',
  tier: 'T4',
  text: 'T4-RESTRICTED-CREDENTIAL',
  forbiddenForCustomerFacing: false,
  provenance: t4Provenance,
};

/** A base GREEN lookup input; each test overrides only the fields it exercises. */
function lookupInput(overrides: Partial<PipelineInput> = {}): PipelineInput {
  return {
    requestKind: 'lookup',
    rawSymptom: 'where is the reset procedure?',
    effectiveConfigSummary: 'Atlas Training Cell, LAB-SANDBOX profile',
    sources: [T1_SOURCE],
    safety: { approvedInformationalLookup: true },
    requesterScope: SCOPE,
    ...overrides,
  };
}

const causes = (...c: [string, number][]): CauseCandidate[] =>
  c.map(([key, prior]) => ({ key, prior, eliminated: false }));

describe('runAnswerPipeline — lookup routing', () => {
  it('GREEN informational lookup with a citable source → grounded Mode A + procedure', async () => {
    const out = await runAnswerPipeline(lookupInput(), new FakeLlm());
    expect(out.safetyZone).toBe('GREEN');
    expect(out.answerMode).toBe('A');
    expect(out.grounded).toBe(true);
    expect(out.procedureEmitted).toBe(true);
    expect(out.emittedFacts.map((f) => f.ref)).toEqual(['manual:p12']);
  });

  it('GREEN lookup with NO citable source → escalates (not source-backed)', async () => {
    const out = await runAnswerPipeline(lookupInput({ sources: [] }), new FakeLlm());
    expect(out.answerMode).toBe('E');
    expect(out.grounded).toBe(false);
    expect(out.procedureEmitted).toBe(false);
    expect(out.escalationReasons).toContain('not_source_backed');
  });
});

describe('runAnswerPipeline — GATE 1: deterministic safety (RED never emits a procedure)', () => {
  it('an energy-bearing context forces RED → Mode E, no procedure', async () => {
    const out = await runAnswerPipeline(
      lookupInput({ safety: { safetyInterlock: true } }),
      new FakeLlm(),
    );
    expect(out.safetyZone).toBe('RED');
    expect(out.answerMode).toBe('E');
    expect(out.procedureEmitted).toBe(false);
    expect(out.escalationReasons).toContain('red_zone');
  });

  it('an explicit unsafe-action request in RED → Mode F (refusal), no procedure', async () => {
    const out = await runAnswerPipeline(
      lookupInput({ safety: { pressurized: true }, unsafeActionRequest: true }),
      new FakeLlm(),
    );
    expect(out.safetyZone).toBe('RED');
    expect(out.answerMode).toBe('F');
    expect(out.procedureEmitted).toBe(false);
  });

  it('a hazard cue monotonically re-escalates a GREEN lookup to RED', async () => {
    const out = await runAnswerPipeline(
      lookupInput({ hazardCues: ['pressurized_leak'] }),
      new FakeLlm(),
    );
    expect(out.safetyZone).toBe('RED');
    expect(out.procedureEmitted).toBe(false);
  });
});

describe('runAnswerPipeline — GATE 2: structural T3/T4 exclusion', () => {
  it('a T3 source never reaches the customer channel (emitted facts or LLM context)', async () => {
    const llm = new FakeLlm({ answer: { text: 'drafted' } });
    const out = await runAnswerPipeline(lookupInput({ sources: [T1_SOURCE, T3_SOURCE] }), llm);
    // Gate 2: only the T1 fact is emitted; the T3 bulletin is excluded.
    expect(out.emittedFacts.map((f) => f.ref)).toEqual(['manual:p12']);
    expect(out.emittedFacts.some((f) => f.tier === 'T3')).toBe(false);
    // The customer generation context physically omits the T3 text.
    expect(llm.answerCalls).toHaveLength(1);
    expect(llm.answerCalls[0]!.context).toContain('T1-MANUAL-TEXT');
    expect(llm.answerCalls[0]!.context).not.toContain('T3-SECRET-BULLETIN');
  });

  it('a T4 source never enters the staff internal-note context (credential isolation, )', async () => {
    const llm = new FakeLlm({ reason: { text: 'staff note' } });
    await runAnswerPipeline(
      lookupInput({ sources: [T1_SOURCE, T4_SOURCE], staffRequester: true }),
      llm,
    );
    // The staff channel may reason over T1/T3 but never T4 — it is credential-isolated.
    expect(llm.reasonCalls).toHaveLength(1);
    expect(llm.reasonCalls[0]!.context).toContain('T1-MANUAL-TEXT');
    expect(llm.reasonCalls[0]!.context).not.toContain('T4-RESTRICTED-CREDENTIAL');
  });

  it('a forbidden-for-customer-facing T1 chunk is excluded from the customer channel', async () => {
    const forbidden: RetrievedSource = {
      ...T1_SOURCE,
      ref: 'manual:hazard',
      forbiddenForCustomerFacing: true,
    };
    const out = await runAnswerPipeline(lookupInput({ sources: [forbidden] }), new FakeLlm());
    expect(out.emittedFacts).toHaveLength(0);
    expect(out.grounded).toBe(false);
  });
});

describe('runAnswerPipeline — GATE 3: output-side provenance (cross-scope hard-block)', () => {
  it('a foreign-tenant source hard-blocks the WHOLE output (fail-closed)', async () => {
    const foreign: RetrievedSource = {
      ...T1_SOURCE,
      ref: 'manual:other-tenant',
      provenance: { tenantId: TENANT_OTHER, tier: 'T1', documentId: DOC_T1, page: 7 },
    };
    const out = await runAnswerPipeline(lookupInput({ sources: [foreign] }), new FakeLlm());
    expect(out.blockedByProvenance).toBe(true);
    expect(out.emittedFacts).toHaveLength(0);
    expect(out.answerMode).toBe('E');
    expect(out.grounded).toBe(false);
  });

  it('a same-tenant wrong-customer T2 source hard-blocks (T2 scope mismatch)', async () => {
    const otherCompany = CompanyId.parse('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    const foreignT2: RetrievedSource = {
      ref: 'owner-config:other',
      tier: 'T2',
      text: 'other-customer-config',
      forbiddenForCustomerFacing: false,
      provenance: {
        tenantId: TENANT,
        tier: 'T2',
        documentId: DOC_T2,
        companyId: otherCompany,
        serialId: SERIAL,
      },
    };
    const out = await runAnswerPipeline(lookupInput({ sources: [foreignT2] }), new FakeLlm());
    expect(out.blockedByProvenance).toBe(true);
    expect(out.emittedFacts).toHaveLength(0);
    expect(out.answerMode).toBe('E');
  });

  it('an in-scope T2 owner-config IS emitted (correctly scoped)', async () => {
    const ownerT2: RetrievedSource = {
      ref: 'owner-config:mine',
      tier: 'T2',
      text: 'my-config',
      forbiddenForCustomerFacing: false,
      provenance: t2Provenance,
    };
    const out = await runAnswerPipeline(lookupInput({ sources: [ownerT2] }), new FakeLlm());
    expect(out.blockedByProvenance).toBe(false);
    expect(out.emittedFacts.map((f) => f.ref)).toEqual(['owner-config:mine']);
    expect(out.answerMode).toBe('A');
  });
});

describe('runAnswerPipeline — diagnostic routing (the  gate)', () => {
  const greenObservation = {
    approvedLowEnergyObservation: false,
    approvedInformationalLookup: true,
  } as const;

  it('a confident, source-backed, GREEN diagnosis → Mode A (auto-resolve)', async () => {
    const out = await runAnswerPipeline(
      lookupInput({
        requestKind: 'diagnostic',
        candidateCauses: causes(['a', 0.9], ['b', 0.1]),
        safety: { ...greenObservation },
      }),
      new FakeLlm(),
    );
    expect(out.answerMode).toBe('A');
    expect(out.confidence).toBe('HIGH');
    expect(out.grounded).toBe(true);
    expect(out.procedureEmitted).toBe(true);
  });

  it('a verified-YELLOW confident diagnosis → Mode B (guided check)', async () => {
    const out = await runAnswerPipeline(
      lookupInput({
        requestKind: 'diagnostic',
        candidateCauses: causes(['a', 0.9], ['b', 0.1]),
        safety: { approvedLowEnergyObservation: true },
        preconditionsVerified: true,
      }),
      new FakeLlm(),
    );
    expect(out.safetyZone).toBe('YELLOW');
    expect(out.answerMode).toBe('B');
    expect(out.procedureEmitted).toBe(true);
  });

  it('a mid-confidence GREEN diagnosis with budget left → Mode C (recommend) + next question', async () => {
    const out = await runAnswerPipeline(
      lookupInput({
        requestKind: 'diagnostic',
        candidateCauses: causes(['a', 0.7], ['b', 0.3]),
        steps: [
          {
            key: 'q-1',
            kind: 'question',
            text: 'When did it start?',
            safetyZone: 'GREEN',
            requiresPreconditions: false,
            // Discriminates a subset of the live mass (a vs the rest) ⇒ informative.
            discriminatesCauseKeys: ['a'],
          },
        ],
        safety: { ...greenObservation },
      }),
      new FakeLlm(),
    );
    expect(out.answerMode).toBe('C');
    expect(out.confidence).toBe('MEDIUM');
    expect(out.procedureEmitted).toBe(false);
    expect(out.nextQuestion?.key).toBe('q-1');
  });

  it('a diffuse set of candidate causes escalates with low_confidence + ambiguous_tie', async () => {
    const out = await runAnswerPipeline(
      lookupInput({
        requestKind: 'diagnostic',
        candidateCauses: causes(
          ['sensor_drift', 0.28],
          ['loose_connector', 0.2],
          ['worn_roller', 0.18],
          ['incorrect_profile', 0.15],
          ['material_variation', 0.12],
          ['unknown_disturbance', 0.07],
        ),
        safety: { approvedLowEnergyObservation: true },
      }),
      new FakeLlm(),
    );
    expect(out.safetyZone).toBe('YELLOW');
    expect(out.answerMode).toBe('E');
    expect(out.escalationReasons).toContain('low_confidence');
    expect(out.escalationReasons).toContain('ambiguous_tie');
  });

  it('an open fleet cluster escalates an otherwise-confident diagnosis', async () => {
    const out = await runAnswerPipeline(
      lookupInput({
        requestKind: 'diagnostic',
        candidateCauses: causes(['a', 0.9], ['b', 0.1]),
        openFleetCluster: true,
        safety: { ...greenObservation },
      }),
      new FakeLlm(),
    );
    expect(out.answerMode).toBe('E');
    expect(out.escalationReasons).toContain('fleet_hold');
  });
});

describe('runAnswerPipeline — grounding gate (last tripwire)', () => {
  it('a recommend-grade diagnosis with NO citable basis downgrades to escalation', async () => {
    const out = await runAnswerPipeline(
      lookupInput({
        requestKind: 'diagnostic',
        candidateCauses: causes(['a', 0.7], ['b', 0.3]),
        sources: [], // nothing citable, draft playbook → unbound claim
        safety: { approvedInformationalLookup: true },
      }),
      new FakeLlm(),
    );
    expect(out.groundingDowngrade).not.toBeNull();
    expect(out.answerMode).toBe('E');
    expect(out.grounded).toBe(false);
  });

  it('a published-playbook step grounds a diagnosis even without documents', async () => {
    const out = await runAnswerPipeline(
      lookupInput({
        requestKind: 'diagnostic',
        candidateCauses: causes(['a', 0.9], ['b', 0.1]),
        sources: [],
        playbookPublished: true,
        steps: [
          {
            key: 'check-1',
            kind: 'check',
            text: 'Read the HMI value.',
            safetyZone: 'GREEN',
            requiresPreconditions: false,
            discriminatesCauseKeys: ['a'],
          },
        ],
        safety: { approvedInformationalLookup: true },
      }),
      new FakeLlm(),
    );
    expect(out.answerMode).toBe('A');
    expect(out.grounded).toBe(true);
    expect(out.groundingDowngrade).toBeNull();
  });
});

describe('runAnswerPipeline — two-channel generation', () => {
  it('staff requesters receive an internal note that may reason over the full (T3) context', async () => {
    const llm = new FakeLlm({ answer: { text: 'customer' }, reason: { text: 'internal' } });
    const out = await runAnswerPipeline(
      lookupInput({ sources: [T1_SOURCE, T3_SOURCE], staffRequester: true }),
      llm,
    );
    expect(out.internalNote).toBe('internal');
    expect(llm.reasonCalls).toHaveLength(1);
    expect(llm.reasonCalls[0]!.context).toContain('T3-SECRET-BULLETIN');
    // The customer channel still excludes T3 even for staff-origin turns.
    expect(out.emittedFacts.some((f) => f.tier === 'T3')).toBe(false);
  });

  it('a pure customer GREEN answer makes no internal-note (reason) call', async () => {
    const llm = new FakeLlm();
    await runAnswerPipeline(lookupInput(), llm);
    expect(llm.reasonCalls).toHaveLength(0);
    expect(llm.answerCalls).toHaveLength(1);
  });
});

describe('generated evidence selection', () => {
  it('returns only selected evidence after generation, preserving the source identity', async () => {
    const other = { ...T1_SOURCE, ref: 'manual:p99', text: 'Another passage' };
    const out = await runAnswerPipeline(
      lookupInput({ sources: [T1_SOURCE, other] }),
      new FakeLlm({ answer: { text: 'A grounded answer', supported: true, sourceIndexes: [1] } }),
    );
    expect(out.emittedFacts.map((fact) => fact.ref)).toEqual(['manual:p99']);
  });
  it('does not present missing information as a grounded answer', async () => {
    const out = await runAnswerPipeline(
      lookupInput(),
      new FakeLlm({
        answer: {
          text: 'The manual does not specify that value.',
          supported: false,
          sourceIndexes: [],
        },
      }),
    );
    expect(out).toMatchObject({
      grounded: false,
      confidence: 'LOW',
      procedureEmitted: false,
      answerMode: 'C',
    });
    expect(out.emittedFacts).toEqual([]);
  });
});
