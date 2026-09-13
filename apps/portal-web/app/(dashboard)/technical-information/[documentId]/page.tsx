import { TRPCError } from '@trpc/server';
import { defineAbilityFor } from '@argoniq/auth';
import { currentActor } from '../../../../lib/trpc/context.js';
import { DocumentManagement } from '../../../../components/document-management.js';
import { type JSX } from 'react';
import { notFound } from 'next/navigation';
import { DocumentId, documentCategoryLabel } from '@argoniq/core-domain';
import { type DocumentHealth } from '@argoniq/core';
import { PageContainer, Stack, StatusDot, Text } from '@argoniq/ui';
import { serverQuery } from '../../../../lib/trpc/server.js';
import { PageChrome } from '../../../../lib/page-chrome.js';
import { DocumentViewer } from '../../../../components/document-viewer.js';

const TIER_LABEL: Record<string, string> = {
  T1: 'Company-visible',
  T2: 'Company-specific',
  T3: 'Internal support',
  T4: 'Restricted',
};

/** Human "applies to" scope derived from which scope columns are set (broadest→narrowest). */
function scopeLabel(doc: {
  serialId: string | null;
  modelId: string | null;
  familyId: string | null;
  companyId: string | null;
}): string {
  if (doc.serialId) return 'This machine';
  if (doc.modelId) return 'Model-specific';
  if (doc.familyId) return 'Family-wide';
  if (doc.companyId) return 'Your organization';
  return 'All machines';
}

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

/** Ingestion-health panel — chunk counts, embedding coverage, and any issues. */
function HealthPanel({ health }: { health: DocumentHealth }): JSX.Element {
  const embedComplete = health.embeddedChunkCount >= health.embeddableChunkCount;
  const stats: { label: string; value: string; warn?: boolean }[] = [
    { label: 'Chunks', value: String(health.chunkCount) },
    {
      label: 'Embedded',
      value: `${health.embeddedChunkCount}/${health.embeddableChunkCount}`,
      warn: !embedComplete,
    },
    { label: 'Tables', value: String(health.tableChunkCount) },
    { label: 'Figures', value: String(health.figureChunkCount) },
  ];
  return (
    <div className="border-border bg-surface-subtle rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="text-text flex items-center gap-2 text-sm font-medium">
          <StatusDot tone={STATE_TONE[health.state] ?? 'neutral'} />
          {STATE_LABEL[health.state] ?? health.status}
        </span>
        {stats.map((s) => (
          <span key={s.label} className="text-text-muted text-sm">
            {s.label}:{' '}
            <span
              className={
                s.warn
                  ? 'nums-tabular text-warning font-medium'
                  : 'nums-tabular text-text font-medium'
              }
            >
              {s.value}
            </span>
          </span>
        ))}
      </div>
      {health.issues.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {health.issues.map((issue) => (
            <li
              key={issue.code}
              className={
                issue.severity === 'error'
                  ? 'text-danger text-sm'
                  : issue.severity === 'warning'
                    ? 'text-warning text-sm'
                    : 'text-text-muted text-sm'
              }
            >
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Document viewer page (RSC). Reads one document through the service layer — which
 * enforces tier + customer scope, so a document the actor may not see resolves to a
 * 404 here, never a partial render. Renders the source PDF beside its revision history
 * and numbered section outline used by citation links.
 */
export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<JSX.Element> {
  const { documentId } = await params;
  const pageParam = Number((await searchParams).page);
  const initialPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  if (!DocumentId.safeParse(documentId).success) notFound();

  const detail = await serverQuery((api) =>
    api.document.get({ documentId: DocumentId.parse(documentId) }),
  ).catch((error: unknown) => {
    if (error instanceof TRPCError && error.code === 'NOT_FOUND') return null;
    throw error;
  });
  if (!detail) notFound();
  const { document, revisions, outline, health } = detail;
  const actor = await currentActor();
  const canManage = actor && defineAbilityFor(actor).can('update', 'Document');
  const sourceUrl = `/api/storage/${document.storageKey}`;
  const isPdf = document.mimeType === 'application/pdf';

  return (
    <PageContainer>
      <PageChrome
        title={document.title}
        breadcrumbs={[
          { label: 'Documents', href: canManage ? '/manage/documents' : '/machines' },
          { label: document.title },
        ]}
      />
      <Stack gap={4}>
        <div className="text-text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {document.docKey && (
            <span>
              Part <span className="text-text font-medium">{document.docKey}</span>
            </span>
          )}
          {document.revisionLabel && <span>Rev {document.revisionLabel}</span>}
          <span>{documentCategoryLabel(document.category)}</span>
          <span>{scopeLabel(document)}</span>
          {!document.indexable && <span className="text-text-subtle">Reference only</span>}
          <span className="bg-surface rounded px-1.5 py-0.5 text-xs">
            {TIER_LABEL[document.tier] ?? document.tier}
          </span>
        </div>

        <DocumentManagement documentId={document.id} />
        {canManage && <HealthPanel health={health} />}

        <a
          href={sourceUrl}
          download={document.originalFilename ?? true}
          className="text-accent focus-visible:outline-focus inline-flex min-h-11 w-fit items-center text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Download source file
        </a>

        {isPdf ? (
          <DocumentViewer
            storageKey={document.storageKey}
            pageCount={document.pageCount}
            revisions={revisions}
            outline={outline}
            initialPage={initialPage}
          />
        ) : (
          <div className="border-border bg-surface rounded-lg border p-4">
            <Text tone="muted">
              Download this file to open it in a compatible application. It remains available while
              document processing is incomplete.
            </Text>
          </div>
        )}
      </Stack>
    </PageContainer>
  );
}
