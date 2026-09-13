import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn.js';

/**
 * StatusDot. A tiny colored dot + a label for inline status —
 * deliberately NOT a badge/chip/pill. Tone maps to the one semantic + safety-zone
 * color language so a "danger" dot and a RED zone read identically. The dot is
 * decorative (aria-hidden); meaning is carried by the visible label, never by
 * color alone (WCAG AA). When used purely decoratively beside adjacent text, omit
 * the label and let the neighbouring text carry meaning.
 */

const dotVariants = cva('inline-block size-2 shrink-0 rounded-full', {
  variants: {
    tone: {
      neutral: 'bg-text-muted',
      info: 'bg-accent',
      success: 'bg-zone-green',
      warning: 'bg-zone-amber',
      danger: 'bg-zone-red',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type StatusDotProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof dotVariants> & {
    /** Visible status text (recommended — color alone is never sufficient). */
    label?: string;
  };

export const StatusDot = forwardRef<HTMLSpanElement, StatusDotProps>(function StatusDot(
  { className, tone, label, children, ...props },
  ref,
) {
  const text = label ?? children;
  return (
    <span
      ref={ref}
      className={cn('text-text inline-flex items-center gap-2 text-sm', className)}
      {...props}
    >
      <span className={dotVariants({ tone })} aria-hidden />
      {text}
    </span>
  );
});
