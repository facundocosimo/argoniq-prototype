import { describe, expect, it } from 'vitest';
import { cn } from './cn.js';

describe('cn', () => {
  it('joins conditional class inputs (clsx behavior)', () => {
    const cond = { enabled: false };
    expect(cn('a', cond.enabled && 'b', undefined, 'c')).toBe('a c');
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c');
  });

  it('resolves conflicting Tailwind utilities so the last one wins (twMerge)', () => {
    // The whole point of cn over a bare clsx: a variant px overrides a base px.
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    expect(cn('rounded-md', 'rounded-lg')).toBe('rounded-lg');
  });
});
