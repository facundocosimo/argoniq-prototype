import { forwardRef, type HTMLAttributes } from 'react';
import { ChevronDown, FileText, ArrowUpRight } from 'lucide-react';
import { type SafetyZone } from '@argoniq/core-domain';
import { cn } from '../lib/cn.js';
import { Markdown } from './markdown.js';
import { SafetyZoneCallout } from './safety-zone-callout.js';

/**
 * AnswerView. A grounded, customer-facing answer: the
 * deterministic SafetyZone treatment on top, the answer prose, then the T1/T2
 * citations it rests on. Every visible technical claim must trace to a citation
 * here (the grounding rule) — this component only renders what the pipeline already
 * grounded. Citations are text only (Anthropic image citations are unsupported;
 * page refs are stamped deterministically — ).
 */
export type CitationView = {
  id: string;
  /** Human label, e.g. "Atlas Training Cell reference". */
  label: string;
  /** Deterministic locator, e.g. "p. 42" or "rev 4.2". */
  ref?: string;
  /** Optional deep-link to the source (the document viewer at the cited page). */
  href?: string;
};

export type AnswerViewProps = HTMLAttributes<HTMLDivElement> & {
  zone: SafetyZone;
  text: string;
  citations?: readonly CitationView[];
  /**
   * Whether to show the SafetyZone treatment. A pure informational question involves no
   * intervention, so "Safe to proceed" is noise — the caller suppresses it for GREEN
   * lookups and shows it only when there's an actual action (YELLOW/RED, or a procedure).
   */
  showSafetyZone?: boolean;
};

export const AnswerView = forwardRef<HTMLDivElement, AnswerViewProps>(function AnswerView(
  { zone, text, citations = [], showSafetyZone = true, className, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn('flex flex-col gap-3', className)} {...props}>
      {showSafetyZone ? <SafetyZoneCallout zone={zone} /> : null}
      <Markdown>{text}</Markdown>
      {citations.length > 0 ? (
        // Collapsible, but expanded by default (the grounding is the point of the product).
        <details open className="group border-border border-t pt-3">
          <summary className="text-text-subtle flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium tracking-wide uppercase select-none">
            <ChevronDown
              className="size-3.5 -rotate-90 transition-transform group-open:rotate-0"
              aria-hidden
            />
            Sources
            <span className="text-text-subtle/70">({citations.length})</span>
          </summary>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {citations.map((citation) => {
              const inner = (
                <>
                  <FileText className="text-text-subtle mt-px size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="text-text-muted group-hover/src:text-text">
                      {citation.label}
                    </span>
                    {citation.ref ? (
                      <span className="text-text-subtle"> · {citation.ref}</span>
                    ) : null}
                  </span>
                  {citation.href ? (
                    <ArrowUpRight
                      className="text-text-subtle group-hover/src:text-accent mt-px size-3.5 shrink-0 transition-colors"
                      aria-hidden
                    />
                  ) : null}
                </>
              );
              const base =
                'flex items-start gap-2 rounded-md border border-border bg-surface-subtle px-2.5 py-2 text-xs';
              return (
                <li key={citation.id}>
                  {citation.href ? (
                    <a
                      href={citation.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        base,
                        'group/src hover:border-border-strong hover:bg-surface transition-colors',
                        'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
                      )}
                    >
                      {inner}
                    </a>
                  ) : (
                    <span className={cn(base, 'group/src')}>{inner}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </div>
  );
});
