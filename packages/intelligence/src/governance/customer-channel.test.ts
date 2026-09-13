import { describe, expect, it } from 'vitest';
import { buildCustomerChannelContext, type KnowledgeSource } from './customer-channel.js';

const sources: KnowledgeSource[] = [
  {
    sourceId: 't1-manual',
    tier: 'T1',
    text: 'Manual rev D, p.7',
    forbiddenForCustomerFacing: false,
  },
  {
    sourceId: 't2-owner',
    tier: 'T2',
    text: 'SC-B-2022-019 as-built',
    forbiddenForCustomerFacing: false,
  },
  {
    sourceId: 't3-bulletin',
    tier: 'T3',
    text: 'SB-PG2 droplets after cleaning',
    forbiddenForCustomerFacing: false,
  },
  {
    sourceId: 't4-defect',
    tier: 'T4',
    text: 'gasket spec marginal on early PG2',
    forbiddenForCustomerFacing: false,
  },
  {
    sourceId: 't1-hazard',
    tier: 'T1',
    text: 'live X1:24 measurement',
    forbiddenForCustomerFacing: true,
  },
];

describe('buildCustomerChannelContext — structural T3/T4 exclusion (gate 2, )', () => {
  it('physically excludes T3 and T4 from the customer channel', () => {
    const ctx = buildCustomerChannelContext(sources);
    const ids = ctx.map((s) => s.sourceId);
    expect(ids).not.toContain('t3-bulletin');
    expect(ids).not.toContain('t4-defect');
  });

  it('includes T1 and owner-scoped T2', () => {
    const ids = buildCustomerChannelContext(sources).map((s) => s.sourceId);
    expect(ids).toContain('t1-manual');
    expect(ids).toContain('t2-owner');
  });

  it('excludes a T1 chunk flagged forbidden_for_customer_facing (chunk-level governance, )', () => {
    const ids = buildCustomerChannelContext(sources).map((s) => s.sourceId);
    expect(ids).not.toContain('t1-hazard');
  });

  it('a T3 chunk can never be paraphrased because it is never in the returned context', () => {
    const ctx = buildCustomerChannelContext(sources);
    expect(ctx.some((s) => s.tier === 'T3' || s.tier === 'T4')).toBe(false);
  });
});
