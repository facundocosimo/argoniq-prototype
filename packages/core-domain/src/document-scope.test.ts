import { describe, expect, it } from 'vitest';
import { DocumentScope } from './document-scope.js';

const companyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const serialId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const installationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('document audience and ownership', () => {
  it.each(['T1', 'T3'])('allows %s catalog scope without company ownership', (tier) => {
    expect(DocumentScope.safeParse({ tier, modelId: serialId }).success).toBe(true);
  });

  it.each(['T1', 'T3'])('rejects %s with company, serial or installation ownership', (tier) => {
    for (const scope of [{ companyId }, { companyId, serialId }, { companyId, installationId }]) {
      expect(DocumentScope.safeParse({ tier, ...scope }).success).toBe(false);
    }
  });

  it('requires a company for a company-specific document', () => {
    for (const scope of [{}, { companyId: null }, { serialId }, { installationId }]) {
      expect(DocumentScope.safeParse({ tier: 'T2', ...scope }).success).toBe(false);
    }
  });

  it('allows company-wide and explicitly owned scopes for relationship validation', () => {
    for (const scope of [
      { companyId },
      { companyId, serialId },
      { companyId, serialId, installationId },
    ]) {
      expect(DocumentScope.safeParse({ tier: 'T2', ...scope }).success).toBe(true);
    }
  });

  it('rejects malformed identifiers rather than treating them as absent scope', () => {
    expect(DocumentScope.safeParse({ tier: 'T2', companyId: '' }).success).toBe(false);
    expect(DocumentScope.safeParse({ tier: 'T1', modelId: 'not-an-id' }).success).toBe(false);
  });
});
