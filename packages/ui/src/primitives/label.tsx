import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

/**
 * Label (correct roles, keyboard-first). Pairs with an Input via
 * `htmlFor`. Purely presentational, so it stays server-compatible.
 */
export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, ...props },
  ref,
) {
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control -- generic primitive; the consumer supplies `htmlFor`/control association at the composition site.
    <label
      ref={ref}
      className={cn('text-text text-sm font-medium select-none', className)}
      {...props}
    />
  );
});
