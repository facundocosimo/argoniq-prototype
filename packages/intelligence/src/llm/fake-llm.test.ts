import { describe, expect, it } from 'vitest';
import { FakeLlm } from './fake-llm.js';

describe('FakeLlm — deterministic test double', () => {
  it('defaults classify to the first label at zero confidence (conservative)', async () => {
    const llm = new FakeLlm();
    const result = await llm.classify({
      instructions: 'classify the symptom',
      input: 'droplets',
      labels: ['SYM-LEAK-DROPLET-DOSINGHEAD', 'UNMAPPED'],
    });
    expect(result.label).toBe('SYM-LEAK-DROPLET-DOSINGHEAD');
    expect(result.confidence).toBe(0);
  });

  it('returns a scripted classify result', async () => {
    const llm = new FakeLlm({
      classify: { label: 'SYM-LEAK-DROPLET-DOSINGHEAD', confidence: 0.9 },
    });
    const result = await llm.classify({
      instructions: 'x',
      input: 'y',
      labels: ['SYM-LEAK-DROPLET-DOSINGHEAD'],
    });
    expect(result.confidence).toBe(0.9);
  });

  it('supports a function script and records the request', async () => {
    const llm = new FakeLlm({
      answer: (req) => ({ text: `echo:${req.prompt}` }),
    });
    const result = await llm.answer({ instructions: 'be grounded', prompt: 'hi', context: [] });
    expect(result.text).toBe('echo:hi');
    expect(llm.answerCalls).toHaveLength(1);
    expect(llm.answerCalls[0]?.prompt).toBe('hi');
  });

  it('records reason calls', async () => {
    const llm = new FakeLlm({ reason: { text: 'internal note' } });
    await llm.reason({ instructions: 'reason', prompt: 'why droplets?', context: ['SB-PG2'] });
    expect(llm.reasonCalls).toHaveLength(1);
    expect(llm.reasonCalls[0]?.context).toContain('SB-PG2');
  });
});
