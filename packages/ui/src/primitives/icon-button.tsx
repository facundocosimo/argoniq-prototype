'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn.js';

/**
 * IconButton  — the one square, icon-only control used across the
 * chrome (toolbar toggles, dropdown/dialog closes, row actions). Centralizes the
 * treatment that was repeated inline in the topbar, drawer, and menus. Token-driven,
 * small radius, visible focus. The `touch` size meets the 44px target (B.7). Always
 * pair with an `aria-label` (or a Tooltip) — the glyph is decorative.
 */
export const iconButtonVariants = cva(
  cn(
    'inline-flex shrink-0 items-center justify-center rounded-md',
    'transition-colors duration-150 ease-out-fast',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'disabled:pointer-events-none disabled:opacity-50',
  ),
  {
    variants: {
      variant: {
        ghost: 'text-text-muted hover:bg-surface hover:text-text',
        subtle: 'border border-border bg-bg text-text-muted hover:bg-surface hover:text-text',
      },
      size: {
        sm: 'size-11 sm:size-8',
        md: 'size-11 sm:size-9',
        touch: 'size-11',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  },
);

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof iconButtonVariants> & {
    /** Render as the child element (e.g. a Radix trigger) while keeping the styling. */
    asChild?: boolean;
  };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant, size, asChild = false, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(iconButtonVariants({ variant, size }), className)}
      type={asChild ? type : (type ?? 'button')}
      {...props}
    />
  );
});
