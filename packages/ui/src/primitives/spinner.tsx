import { forwardRef, type HTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/cn.js';

/**
 * Spinner. Minimal, fast rotation — for inline loading states.
 * Has an accessible role/label so screen readers announce loading. Presentational,
 * so server-compatible (CSS-driven animation, no client JS).
 */
export type SpinnerProps = HTMLAttributes<HTMLSpanElement> & {
  /** Accessible label announced to assistive tech. */
  label?: string;
};

export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { className, label = 'Loading', ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn('text-text-muted inline-flex', className)}
      {...props}
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
    </span>
  );
});
