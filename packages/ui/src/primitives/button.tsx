'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn.js';

/**
 * Button. Radii ≤ 6px — never pill-shaped. Variants
 * are the four canonical intents; `danger` maps to the RED-zone color family.
 * Token-driven only; no hard-coded color/px. Accessible: real <button>, visible
 * focus ring from the base layer, disabled state communicated, ≥ 44px tap target
 * on the comfortable size.
 */
export const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md',
    'font-medium select-none transition-[color,background-color,border-color,box-shadow,opacity] duration-150 ease-out-fast',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'disabled:pointer-events-none disabled:opacity-50',
  ),
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-contrast shadow-xs hover:bg-accent-hover',
        secondary:
          'border border-border bg-bg text-text shadow-xs hover:bg-surface hover:border-border-strong',
        ghost: 'bg-transparent text-text-muted hover:bg-surface hover:text-text',
        danger: 'bg-danger text-danger-contrast shadow-xs hover:opacity-90',
      },
      size: {
        // Compact desktop controls retain a 44px target on coarse pointers,
        // including tablets. Screen width alone does not establish precision.
        sm: 'h-11 gap-1.5 px-3 text-sm sm:h-8 [@media(pointer:coarse)]:h-11',
        md: 'h-11 px-3.5 text-sm sm:h-9 [@media(pointer:coarse)]:h-11',
        lg: 'h-11 px-5 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** Render as the child element (e.g. an anchor) while keeping button styling. */
    asChild?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      // A bare <button> defaults to type="submit"; default to "button" unless overridden.
      type={asChild ? type : (type ?? 'button')}
      {...props}
    />
  );
});
