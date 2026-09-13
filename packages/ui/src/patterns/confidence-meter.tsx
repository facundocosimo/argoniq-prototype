import { type HTMLAttributes, type JSX } from 'react';
import { type ConfidenceBand, CONFIDENCE_BAND_LABELS } from '@argoniq/core-domain';
import { cn } from '../lib/cn.js';

/**
 * ConfidenceMeter  — an ORDINAL confidence signal: three ascending
 * bars (Low→High), never a decimal. Company surfaces show bands only; this is the
 * visual companion to ConfidenceText. The bar count + color encode the band; the
 * label and an sr-only string carry the meaning (never color alone, WCAG AA).
 */
const FILLED: Record<ConfidenceBand, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const FILL_COLOR: Record<ConfidenceBand, string> = {
  HIGH: 'bg-zone-green',
  MEDIUM: 'bg-zone-amber',
  LOW: 'bg-text-subtle',
};
const TEXT_COLOR: Record<ConfidenceBand, string> = {
  HIGH: 'text-zone-green',
  MEDIUM: 'text-zone-amber',
  LOW: 'text-text-muted',
};
const BAR_HEIGHT = ['h-1.5', 'h-2.5', 'h-3.5'];

export type ConfidenceMeterProps = HTMLAttributes<HTMLDivElement> & {
  band: ConfidenceBand;
  showLabel?: boolean;
};

export function ConfidenceMeter({
  band,
  showLabel = true,
  className,
  ...props
}: ConfidenceMeterProps): JSX.Element {
  const filled = FILLED[band];
  return (
    <div className={cn('inline-flex items-center gap-2', className)} {...props}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={cn(
              'w-1 rounded-full',
              BAR_HEIGHT[index],
              index < filled ? FILL_COLOR[band] : 'bg-border',
            )}
          />
        ))}
      </span>
      {showLabel ? (
        <span className={cn('text-xs font-medium', TEXT_COLOR[band])}>
          {CONFIDENCE_BAND_LABELS[band]}
        </span>
      ) : (
        <span className="sr-only">{CONFIDENCE_BAND_LABELS[band]} confidence</span>
      )}
    </div>
  );
}
