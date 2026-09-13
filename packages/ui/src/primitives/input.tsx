'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

/**
 * Input. 1px border over shadow, radius ≤ 6px, token-driven.
 * Invalid state is communicated with the danger token + aria-invalid, never with
 * a heavy treatment.
 */
export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'border-border bg-bg text-text h-11 w-full rounded-md border px-3 text-base sm:h-9 sm:text-sm',
        'placeholder:text-text-subtle ease-out-fast transition-colors duration-150',
        'hover:border-border-strong',
        'focus-visible:border-accent focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  );
});
