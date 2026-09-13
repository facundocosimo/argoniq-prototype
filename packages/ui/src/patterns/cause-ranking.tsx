import { forwardRef, type HTMLAttributes } from 'react';
import { type ConfidenceBand } from '@argoniq/core-domain';
import { cn } from '../lib/cn.js';
import { ConfidenceMeter } from './confidence-meter.js';

/**
 * CauseRankingList (stage 5). The ranked candidate causes with
 * ordinal confidence BANDS only — never a raw decimal on a customer surface. Dense,
 * hairline-ruled rows; the rank is quiet, the cause label leads, an optional
 * rationale sits beneath, and the band reads as colored inline text (no chips).
 */
export type RankedCauseView = {
  key: string;
  label: string;
  confidence: ConfidenceBand;
  /** One-line, grounded rationale (customer-safe — never T3 content). */
  rationale?: string;
};

export type CauseRankingListProps = HTMLAttributes<HTMLOListElement> & {
  causes: readonly RankedCauseView[];
  showConfidence?: boolean;
};

export const CauseRankingList = forwardRef<HTMLOListElement, CauseRankingListProps>(
  function CauseRankingList({ causes, showConfidence = true, className, ...props }, ref) {
    return (
      <ol ref={ref} className={cn('flex flex-col', className)} {...props}>
        {causes.map((cause, index) => (
          <li
            key={cause.key}
            className="border-border flex items-start gap-3 border-b py-3 first:pt-0 last:border-0 last:pb-0"
          >
            <span
              className="nums-tabular text-text-subtle mt-px w-5 shrink-0 text-sm font-medium"
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-text text-sm font-medium">{cause.label}</span>
                {showConfidence ? (
                  <ConfidenceMeter band={cause.confidence} className="shrink-0" />
                ) : null}
              </div>
              {cause.rationale ? (
                <span className="text-text-muted text-xs">{cause.rationale}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    );
  },
);
