'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

/**
 * Textarea. Same token-driven treatment as Input; used by the
 * symptom composer and case notes. Comfortable min height for one-handed use.
 */
export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'border-border bg-bg text-text min-h-24 w-full rounded-md border px-3 py-2.5 text-base sm:min-h-20 sm:py-2 sm:text-sm',
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
