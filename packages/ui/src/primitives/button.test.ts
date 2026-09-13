import { describe, expect, it } from 'vitest';
import { buttonVariants } from './button.js';

/**
 * Test the variant class *output* (pure cva — no DOM needed). This locks in the
 * design-system contract: each intent maps to its token-driven classes, radii
 * stay ≤ 6px (rounded-md), and NOTHING is pill-shaped (no rounded-full).
 */
describe('buttonVariants', () => {
  it('uses a small radius and is never pill-shaped', () => {
    const cls = buttonVariants();
    expect(cls).toContain('rounded-md');
    expect(cls).not.toContain('rounded-full');
  });

  it('maps each intent to its token-driven surface', () => {
    expect(buttonVariants({ variant: 'primary' })).toContain('bg-accent');
    expect(buttonVariants({ variant: 'secondary' })).toContain('border-border');
    expect(buttonVariants({ variant: 'ghost' })).toContain('bg-transparent');
    expect(buttonVariants({ variant: 'danger' })).toContain('bg-danger');
  });

  it('applies the default variant/size when none is given', () => {
    const cls = buttonVariants();
    expect(cls).toContain('bg-accent');
    // Default (md) is a dense 36px control (Linear-grade); the comfortable 44px
    // touch target lives on `size="lg"`.
    expect(cls).toContain('h-9');
  });

  it('exposes a visible focus ring (keyboard-first, WCAG AA)', () => {
    expect(buttonVariants()).toContain('focus-visible:outline-focus');
  });
});
