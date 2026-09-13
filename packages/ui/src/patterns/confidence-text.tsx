import { forwardRef, type HTMLAttributes } from 'react';
import { type ConfidenceBand, CONFIDENCE_BAND_LABELS } from '@argoniq/core-domain';
import { cn } from '../lib/cn.js';

/**
 * ConfidenceText. Renders a ConfidenceBand as
 * colored inline typographic status — NOT a badge. Company surfaces show bands
 * only (never a raw decimal). The band's color maps to the same semantic language:
 * HIGH reads calm/positive, MEDIUM cautionary, LOW muted. Meaning is in the label,
 * not color alone (WCAG AA).
 */

const BAND_TEXT: Record<ConfidenceBand, string> = {
  HIGH: 'text-zone-green',
  MEDIUM: 'text-zone-amber',
  LOW: 'text-text-muted',
};

export type ConfidenceTextProps = Omit<HTMLAttributes<HTMLSpanElement>, 'color'> & {
  band: ConfidenceBand;
  /** Override the canonical band label (defaults to CONFIDENCE_BAND_LABELS[band]). */
  label?: string;
};

export const ConfidenceText = forwardRef<HTMLSpanElement, ConfidenceTextProps>(
  function ConfidenceText({ className, band, label, ...props }, ref) {
    return (
      <span ref={ref} className={cn('text-sm font-medium', BAND_TEXT[band], className)} {...props}>
        {label ?? CONFIDENCE_BAND_LABELS[band]}
      </span>
    );
  },
);
