'use client';
import Link from 'next/link';

import { type JSX, useState } from 'react';
import { FileText, History, ListTree } from 'lucide-react';
import { StatusDot, Text } from '@argoniq/ui';

/**
 * Document viewer — the reading surface for one document. It embeds the source PDF
 * (streamed through the guarded `/api/storage` route) beside the document's own
 * numbered section outline and revision history. Clicking a section deep-links the embedded
 * PDF to that page via the `#page=N` fragment (the browser's native PDF viewer honors
 * it) — the same page/section handle the answer pipeline cites, so "see, p.4" in a chat
 * answer and this viewer point at the exact same place.
 */
export interface ViewerRevision {
  readonly id: string;
  readonly revisionLabel: string | null;
  readonly revisionNumber: number;
  readonly isCurrent: boolean;
  readonly effectiveFrom: string | Date | null;
  readonly status: string;
}
export interface ViewerOutlineEntry {
  readonly sectionPath: string;
  readonly sectionTitle: string | null;
  readonly page: number | null;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ingested: 'success',
  processing: 'warning',
  uploaded: 'warning',
  failed: 'danger',
};

function formatDate(value: string | Date | null): string | null {
  if (!value) return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

export function DocumentViewer({
  storageKey,
  pageCount,
  revisions,
  outline,
  initialPage = 1,
}: {
  readonly storageKey: string;
  readonly pageCount: number | null;
  readonly revisions: readonly ViewerRevision[];
  readonly outline: readonly ViewerOutlineEntry[];
  /** Open the PDF at this page (a chat citation can deep-link to  on page 4). */
  readonly initialPage?: number;
}): JSX.Element {
  const [page, setPage] = useState(initialPage);
  // `view=FitH` opens fit-to-width (not the browser's tiny default zoom); `#page` navigates.
  const src = `/api/storage/${storageKey}#page=${page}&view=FitH`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      {/* The embedded source PDF — re-keyed on page so the #page fragment re-navigates. */}
      <div className="border-border bg-surface min-h-[70vh] overflow-hidden rounded-lg border">
        <iframe key={page} src={src} title="Document source" className="h-[70vh] w-full" />
      </div>

      <aside className="flex flex-col gap-5">
        {revisions.length > 0 && (
          <section>
            <div className="text-text-subtle mb-2 flex items-center gap-2">
              <History className="size-4" aria-hidden />
              <Text size="sm" weight="medium">
                Revisions
              </Text>
            </div>
            <ul className="flex flex-col gap-1.5">
              {revisions.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <StatusDot tone={STATUS_TONE[r.status] ?? 'neutral'} />
                    <Link
                      className="text-accent hover:underline"
                      href={`/technical-information/${r.id}`}
                    >
                      Rev {r.revisionLabel ?? r.revisionNumber}
                    </Link>
                    {r.isCurrent && (
                      <span className="bg-accent-subtle text-accent rounded px-1.5 py-0.5 text-xs">
                        current
                      </span>
                    )}
                  </span>
                  <span className="nums-tabular text-text-subtle">
                    {formatDate(r.effectiveFrom) ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {outline.length > 0 && (
          <section className="min-h-0 flex-1">
            <div className="text-text-subtle mb-2 flex items-center gap-2">
              <ListTree className="size-4" aria-hidden />
              <Text size="sm" weight="medium">
                Sections
              </Text>
            </div>
            <ul className="flex max-h-[52vh] flex-col gap-0.5 overflow-y-auto pr-1">
              {outline.map((s) => (
                <li key={`${s.sectionPath}-${s.page}`}>
                  <button
                    type="button"
                    onClick={() => s.page && setPage(s.page)}
                    className="hover:bg-surface-hover flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left text-sm disabled:opacity-50"
                    disabled={!s.page}
                  >
                    <span className="nums-tabular text-text-subtle shrink-0 font-medium">
                      {s.sectionPath}
                    </span>
                    <span className="text-text-muted truncate">{s.sectionTitle ?? '—'}</span>
                    {s.page && (
                      <span className="nums-tabular text-text-subtle ml-auto shrink-0">
                        p{s.page}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="border-border text-text-subtle flex items-center gap-2 border-t pt-3">
          <FileText className="size-4" aria-hidden />
          <Text size="sm" tone="muted">
            {pageCount ? `${pageCount} pages` : 'Source PDF'}
          </Text>
        </div>
      </aside>
    </div>
  );
}
