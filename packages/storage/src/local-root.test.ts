import { isAbsolute } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveLocalRoot } from './local-root.js';

describe('resolveLocalRoot', () => {
  it('passes an absolute root through unchanged', () => {
    expect(resolveLocalRoot('/var/data/argoniq')).toBe('/var/data/argoniq');
  });

  it('anchors a relative root to an absolute path (monorepo root, not CWD)', () => {
    const resolved = resolveLocalRoot('.storage');
    expect(isAbsolute(resolved)).toBe(true);
    expect(resolved.endsWith('.storage')).toBe(true);
  });

  it('anchors the same absolute root regardless of the caller', () => {
    // Two callers with different intent must resolve the same shared directory —
    // this is what keeps the uploader (web) and the worker pointed at one folder.
    expect(resolveLocalRoot('.storage')).toBe(resolveLocalRoot('.storage'));
  });
});
