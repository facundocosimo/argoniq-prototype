import { type JSX } from 'react';
import { Info } from 'lucide-react';
import { cn } from '../lib/cn.js';

/**
 * AI-interaction disclosure (EU AI Act Article 50(1), applies 2 August 2026):
 * users must be informed they are interacting with an AI system. This is a
 * COMPLIANCE control, not marketing — the first sentence is the required statement
 * and lives in `AI_DISCLOSURE_STATEMENT` so it is locked by a test and cannot be
 * silently emptied. The component is rendered ALWAYS on the Guided Resolution
 * surface (before any answer); it is a tenant-level default an OEM cannot remove.
 *
 * A calm, informational notice — token-driven, low-emphasis, never a modal that
 * blocks the flow. The rest of the copy is honest context (grounded, cited,
 * safety-checked, escalates) in the product voice.
 */
export const AI_DISCLOSURE_STATEMENT = 'You are interacting with an AI system.' as const;

export type AiDisclosureProps = {
  /** The OEM/provider name woven into the notice (defaults to a generic phrasing). */
  providerName?: string;
  /** Short persistent disclosure for space-constrained conversation composers. */
  compact?: boolean;
  className?: string;
};

export function AiDisclosure({
  providerName,
  compact = false,
  className,
}: AiDisclosureProps): JSX.Element {
  const source = providerName ? `${providerName}’s` : 'your OEM’s';
  return (
    <div
      role="note"
      aria-label="AI system disclosure"
      className={cn(
        'flex items-start gap-2.5',
        compact
          ? 'text-xs'
          : 'border-border bg-accent-subtle rounded-md border px-3 py-2.5 text-sm',
        className,
      )}
    >
      <Info className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="text-text-muted">
        <span className="text-text font-medium">{AI_DISCLOSURE_STATEMENT}</span>
        {compact ? (
          ' Check sources before acting.'
        ) : (
          <>
            {' '}
            ArgonIQ draws on {source} approved technical information and cites its sources. Check
            the original documents before acting. You can review and submit a support request when
            you need help from your OEM.
          </>
        )}
      </p>
    </div>
  );
}
