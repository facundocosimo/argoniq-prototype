import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createTestBudget } from './test-budget.mjs';

const url = 'https://ai-gateway.vercel.sh/v3/ai/language-model';
const options = (extra = {}) => ({
  method: 'POST',
  headers: { 'ai-language-model-id': 'openai/gpt-5.6-sol' },
  body: JSON.stringify({ maxOutputTokens: 1024, prompt: 'Example', ...extra }),
});

test('rejects unpriced models, paid tools and unbounded output before sending', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'argoniq-budget-'));
  t.after(() => rmSync(dir, { recursive: true }));
  let calls = 0;
  const budget = createTestBudget(join(dir, 'ledger.json'), async () => {
    calls++;
  });
  await assert.rejects(budget.fetch(url, options({ maxOutputTokens: 4096 })), /bounded/);
  await assert.rejects(budget.fetch(url, options({ tools: [{}] })), /bounded/);
  await assert.rejects(
    budget.fetch(url, { ...options(), headers: { 'ai-language-model-id': 'unknown' } }),
    /verified/,
  );
  await assert.rejects(budget.fetch('https://other.invalid', options()), /Gateway/);
  assert.equal(calls, 0);
});

test('keeps failed reservations across restarts and refuses calls beyond the cap', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'argoniq-budget-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'ledger.json');
  let calls = 0;
  const fail = async () => {
    calls++;
    throw new Error('unknown response');
  };
  const budget = createTestBudget(path, fail);
  await assert.rejects(
    budget.fetch(url, options({ prompt: 'x'.repeat(70000) })),
    /unknown response/,
  );
  const resumed = createTestBudget(path, fail);
  assert.equal(resumed.upperUsd(), budget.upperUsd());
  await assert.rejects(resumed.fetch(url, options({ prompt: 'x'.repeat(70000) })), /exhausted/);
  assert.equal(calls, 1);
});

test('reconciles a successful call from measured usage and records gateway cost', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'argoniq-budget-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const budget = createTestBudget(join(dir, 'ledger.json'), async () =>
    Response.json({
      usage: { inputTokens: { total: 100 }, outputTokens: { total: 20 } },
      providerMetadata: { gateway: { cost: '0.0004' } },
    }),
  );
  await budget.fetch(url, options());
  assert.equal(budget.upperUsd(), 100 * 0.00001 + 20 * 0.00004);
  assert.equal(budget.ledger.calls[0].gatewayCostUsd, 0.0004);
});
