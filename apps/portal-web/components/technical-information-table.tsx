'use client';

import { type JSX, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, BookText, FileText, RefreshCw } from 'lucide-react';
import { DocumentId, documentCategoryLabel } from '@argoniq/core-domain';
import { type DocumentListItem } from '@argoniq/core';
import { DataTable, IconButton, StatusDot, type ColumnDef } from '@argoniq/ui';
import { trpc } from '../lib/trpc/client.js';

/**
 * Controlled document catalog. Rows are grouped by logical document identity
 * (`docKey`), so each manual shows its current revision and revision count. The
 * service filters restricted tiers for customer users. OEM staff can retry ingestion
 * for a failed document.
 */
/** Rolled-up health state → dot tone + label (mirrors the derived `health.state`). */
const STATE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ready: 'success',
  degraded: 'warning',
  pending: 'warning',
  failed: 'danger',
};
const STATE_LABEL: Record<string, string> = {
  ready: 'Ready',
  degraded: 'Needs attention',
  pending: 'Processing',
  failed: 'Failed',
};

function scopeLabel(d: DocumentListItem): string {
  if (d.serialId) return 'This machine';
  if (d.modelId) return 'Model-specific';
  if (d.familyId) return 'Family-wide';
  if (d.companyId) return 'Your organization';
  return 'All machines';
}

type CatalogRow = DocumentListItem & { readonly revisionCount: number };

/** Whether OEM staff can re-run ingestion here: PDFs are ingestable; failed docs always offer a retry. */
function canReingest(row: CatalogRow): boolean {
  return row.indexable && row.publication === 'draft' && row.status !== 'processing';
}

/** Collapse revisions of the same logical document into one representative (current) row. */
function groupByIdentity(documents: readonly DocumentListItem[]): CatalogRow[] {
  const groups = new Map<string, DocumentListItem[]>();
  for (const d of documents) {
    const key = d.revisionGroupId;
    const list = groups.get(key);
    if (list) list.push(d);
    else groups.set(key, [d]);
  }
  return [...groups.values()].map((revs) => {
    const current =
      revs.find((r) => r.isCurrent) ??
      [...revs].sort((a, b) => b.revisionNumber - a.revisionNumber)[0]!;
    return { ...current, revisionCount: revs.length };
  });
}

function ReprocessButton({ documentId }: { documentId: string }): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const reprocess = trpc.document.reprocess.useMutation({
    onSettled: () => {
      setBusy(false);
      router.refresh();
    },
  });
  return (
    <IconButton
      aria-label="Re-run ingestion"
      title="Re-run ingestion"
      variant="ghost"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        reprocess.mutate({ documentId: DocumentId.parse(documentId) });
      }}
    >
      <RefreshCw className={busy ? 'size-4 animate-spin' : 'size-4'} aria-hidden />
    </IconButton>
  );
}

export function TechnicalInformationTable({
  documents,
  canManage,
}: {
  documents: readonly DocumentListItem[];
  canManage: boolean;
}): JSX.Element {
  const rows = groupByIdentity(documents);

  const columns: ColumnDef<CatalogRow>[] = [
    {
      accessorKey: 'title',
      header: 'Document',
      cell: ({ row }) => (
        <Link
          href={`/technical-information/${row.original.id}`}
          className="text-text hover:text-accent flex items-center gap-2 font-medium"
        >
          <FileText className="text-text-subtle size-4 shrink-0" aria-hidden />
          <span className="truncate">{row.original.title}</span>
          {row.original.revisionLabel && (
            <span className="text-text-subtle shrink-0 text-xs">
              Rev {row.original.revisionLabel}
            </span>
          )}
          {row.original.revisionCount > 1 && (
            <span className="bg-surface text-text-muted shrink-0 rounded px-1.5 py-0.5 text-xs">
              {row.original.revisionCount} revisions
            </span>
          )}
        </Link>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Type',
      cell: ({ row }) => (
        <span className="text-text-muted">{documentCategoryLabel(row.original.category)}</span>
      ),
    },
    {
      id: 'scope',
      header: 'Applies to',
      cell: ({ row }) => <span className="text-text-muted">{scopeLabel(row.original)}</span>,
    },
    {
      accessorKey: 'pageCount',
      header: 'Pages',
      cell: ({ row }) => (
        <span className="nums-tabular text-text-muted">{row.original.pageCount ?? '—'}</span>
      ),
    },
    {
      id: 'chunks',
      header: 'Chunks',
      cell: ({ row }) => {
        const h = row.original.health;
        const partial = h.embeddedChunkCount < h.embeddableChunkCount;
        return (
          <span className="nums-tabular text-text-muted flex items-center gap-1.5">
            <span>{h.chunkCount}</span>
            {partial && (
              <span className="text-warning text-xs" title={h.issues[0]?.message}>
                {h.embeddedChunkCount}/{h.embeddableChunkCount} embedded
              </span>
            )}
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const h = row.original.health;
        const issue = h.issues[0];
        return (
          <span className="text-text-muted flex items-center gap-2">
            <StatusDot tone={STATE_TONE[h.state] ?? 'neutral'} />
            {STATE_LABEL[h.state] ?? h.status}
            {issue && issue.severity !== 'info' && (
              <span title={issue.message} className="inline-flex">
                <AlertTriangle
                  className={
                    issue.severity === 'error' ? 'text-danger size-3.5' : 'text-warning size-3.5'
                  }
                  aria-label={issue.message}
                />
              </span>
            )}
            {canManage && canReingest(row.original) && (
              <ReprocessButton documentId={row.original.id} />
            )}
          </span>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={
        canManage
          ? columns
          : columns.filter((column) => !('id' in column && column.id === 'chunks'))
      }
      data={rows}
      getRowId={(row) => row.id}
      caption="Approved technical information"
      renderMobileCard={(doc) => (
        <Link href={`/technical-information/${doc.id}`} className="flex flex-col gap-1">
          <span className="text-text flex items-center gap-2 font-medium">
            <BookText className="text-text-subtle size-4 shrink-0" aria-hidden />
            {doc.title}
            {doc.revisionLabel && (
              <span className="text-text-subtle text-xs">Rev {doc.revisionLabel}</span>
            )}
          </span>
          <span className="text-text-muted flex items-center justify-between gap-2 text-xs">
            <span>
              {documentCategoryLabel(doc.category)} · {scopeLabel(doc)}
            </span>
            <span className="flex items-center gap-1.5">
              <StatusDot tone={STATE_TONE[doc.health.state] ?? 'neutral'} />
              {doc.health.chunkCount} chunks
            </span>
          </span>
        </Link>
      )}
    />
  );
}
