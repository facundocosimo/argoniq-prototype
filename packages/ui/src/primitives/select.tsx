'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

/**
 * Select  — the native `<select>`, tokenized to match `Input`: 1px
 * border, radius ≤ 6px, danger token on `aria-invalid`. Native by design so it
 * drops into `<FormControl>` (the id/aria wiring lands on the control itself) and
 * is keyboard/screen-reader correct without a bespoke listbox. Compose `<option>`
 * children.
 */
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        'border-border bg-bg text-text h-11 w-full rounded-md border px-3 text-base sm:h-9 sm:text-sm',
        'ease-out-fast transition-colors duration-150',
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
