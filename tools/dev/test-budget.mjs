import { existsSync, readFileSync, writeFileSync } from 'node:fs';
/** Local spend ceiling for optional live-provider samples. Failed or uncertain calls retain their reservation. */
export function createTestBudget(path, fetchFn = fetch) {
  const limitUsd = 1;
  const ledger = existsSync(path)
    ? JSON.parse(readFileSync(path, 'utf8'))
    : { limitUsd, calls: [] };
  const save = () => writeFileSync(path, JSON.stringify(ledger, null, 2) + '\n', { mode: 0o600 });
  const spent = () => ledger.calls.reduce((sum, call) => sum + call.upperUsd, 0);
  return {
    ledger,
    upperUsd: spent,
    fetch: async (url, options = {}) => {
      if (new URL(url.toString()).hostname !== 'ai-gateway.vercel.sh')
        throw new Error('Sample budget only permits Vercel AI Gateway.');
      if ((options.method ?? 'GET') === 'GET') return fetchFn(url, options);
      const headers = new Headers(options.headers);
      const model = headers.get('ai-language-model-id') ?? headers.get('ai-model-id');
      const embedding = model === 'openai/text-embedding-3-small';
      if (!embedding && model !== 'openai/gpt-5.6-sol')
        throw new Error('Model has no verified sample budget rate.');
      if (typeof options.body !== 'string') throw new Error('Expected bounded JSON SDK request.');
      const body = JSON.parse(options.body);
      const outputLimit = embedding ? 0 : body.maxOutputTokens;
      if (
        !Number.isInteger(outputLimit) ||
        outputLimit < 0 ||
        outputLimit > 2048 ||
        body.tools?.length
      )
        throw new Error('Sample requests must have bounded output and no paid tools.');
      const bytes = Buffer.byteLength(options.body);
      if (bytes > 100_000) throw new Error('Sample request too large.');
      // UTF-8 bytes conservatively bound text tokens; reserve extra protocol/schema overhead.
      const inputRate = embedding ? 0.0000001 : 0.00001;
      const reserve = (bytes + 2048) * inputRate + outputLimit * 0.00004;
      if (spent() + reserve > limitUsd)
        throw new Error('Sample budget exhausted before sending request.');
      const call = { model, upperUsd: reserve, status: 'reserved' };
      ledger.calls.push(call);
      save();
      const response = await fetchFn(url, options);
      if (response.ok) {
        const result = await response.clone().json();
        const input = embedding ? result.usage?.tokens : result.usage?.inputTokens?.total;
        const output = embedding ? 0 : result.usage?.outputTokens?.total;
        if (Number.isFinite(input) && input >= 0 && Number.isFinite(output) && output >= 0) {
          call.inputTokens = input;
          call.outputTokens = output;
          call.upperUsd = input * inputRate + output * 0.00004;
          call.status = 'completed';
          const cost = Number(result.providerMetadata?.gateway?.cost);
          if (Number.isFinite(cost) && cost >= 0) call.gatewayCostUsd = cost;
        }
      } else call.status = `http-${response.status}`;
      save();
      return response;
    },
  };
}
