import { type JSX } from 'react';
import Link from 'next/link';
import { defineAbilityFor } from '@argoniq/auth';
import { currentActor } from '../../../../../lib/trpc/context.js';
import { notFound } from 'next/navigation';
import { Button, Input, PageContainer, Stack } from '@argoniq/ui';
import { serverQuery } from '../../../../../lib/trpc/server.js';
import { PageChrome } from '../../../../../lib/page-chrome.js';
import {
  DocumentsLibrary,
  type DocumentsView,
} from '../../../../../components/manage/documents-library.js';

/**
 * OEM Knowledge Library (Administration). The OEM's tenant-wide view of the whole
 * knowledge corpus — the authoring/governance counterpart to the customer's per-machine
 * Manuals view. The three lenses (Library / Coverage / Resolve preview) are SUB-ROUTES
 * (`/manage/documents[/coverage|/resolve]`) so they live as sidebar sub-items, not
 * in-page tabs. OEM-staff only (the `/manage` layout guards it).
 */
const VIEW_META: Record<DocumentsView, { title: string; blurb: string }> = {
  library: {
    title: 'Documents',
    blurb:
      'Every controlled document across your product catalog — authored once at the broadest valid scope and resolved down to each machine.',
  },
  coverage: {
    title: 'Coverage',
    blurb: 'Which document types exist for each model. Empty cells are gaps in the catalog.',
  },
  resolve: {
    title: 'Resolve preview',
    blurb:
      'Pick a machine to see exactly what the assistant would use for it, and the channel each source reaches.',
  },
};

/**
 * Drain a cursor-paginated list endpoint into a single array. The library needs the
 * WHOLE corpus (coverage/gaps can't be computed from one page), and `limit` is capped
 * at 100 — so page through it. Bounded (20 pages = 2000 rows) as a runaway guard.
 */
async function fetchAll<T>(
  fetchPage: (
    cursor: string | undefined,
  ) => Promise<{ items: readonly T[]; pageInfo: { nextCursor: string | null } }>,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  while (true) {
    const { items: pageItems, pageInfo } = await fetchPage(cursor);
    items.push(...pageItems);
    if (!pageInfo.nextCursor) break;
    cursor = pageInfo.nextCursor;
  }
  return items;
}

export default async function DocumentsLibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ view?: string[] }>;
  searchParams: Promise<{ cursor?: string; search?: string }>;
}): Promise<JSX.Element> {
  const segment = (await params).view?.[0] ?? 'library';
  if (segment !== 'library' && segment !== 'coverage' && segment !== 'resolve') notFound();
  const view: DocumentsView = segment;
  const actor = await currentActor();
  const canUpload = actor && defineAbilityFor(actor).can('create', 'Document');

  const { cursor, search } = await searchParams;
  const documentPage =
    view === 'library'
      ? await serverQuery((api) =>
          api.document.list({
            limit: 50,
            ...(cursor ? { cursor } : {}),
            ...(search ? { search } : {}),
          }),
        )
      : null;
  const [families, documents, serials] = await Promise.all([
    serverQuery((api) => api.management.listFamilies()),
    documentPage
      ? Promise.resolve(documentPage.items)
      : fetchAll((cursor) =>
          serverQuery((api) => api.document.list({ limit: 100, ...(cursor ? { cursor } : {}) })),
        ),
    fetchAll((cursor) =>
      serverQuery((api) => api.machine.listSerials({ limit: 100, ...(cursor ? { cursor } : {}) })),
    ),
  ]);

  // Models per family (for the hierarchy, chips, and the coverage matrix rows).
  const modelsPerFamily = await Promise.all(
    families.map((f) => serverQuery((api) => api.management.listModels({ familyId: f.id }))),
  );
  const models = modelsPerFamily
    .flat()
    .map((m) => ({ id: m.id, familyId: m.familyId, name: m.name }));

  const meta = VIEW_META[view];
  return (
    <PageContainer>
      <PageChrome
        title={meta.title}
        breadcrumbs={[
          { label: 'Documents', href: '/manage/documents' },
          ...(view === 'library' ? [] : [{ label: meta.title }]),
        ]}
        actions={
          canUpload ? (
            <Button asChild size="sm">
              <Link href="/manage/documents/upload">Upload document</Link>
            </Button>
          ) : null
        }
      />
      <Stack gap={4}>
        {view === 'library' && (
          <form className="flex flex-wrap items-end gap-2" action="/manage/documents">
            <div>
              <label htmlFor="document-search" className="mb-1 block text-sm">
                Search all document titles
              </label>
              <Input id="document-search" name="search" defaultValue={search ?? ''} />
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        )}
        <DocumentsLibrary
          view={view}
          families={families.map((f) => ({ id: f.id, name: f.name }))}
          models={models}
          documents={documents}
          serials={serials.map((s) => ({
            id: s.id,
            serialNumber: s.serialNumber,
            familyId: s.familyId,
            modelId: s.modelId,
          }))}
        />
        {documentPage && (
          <div className="flex min-h-11 items-center gap-4">
            {cursor && (
              <Link
                className="text-accent"
                href={`/manage/documents?search=${encodeURIComponent(search ?? '')}`}
              >
                First page
              </Link>
            )}
            {documentPage.pageInfo.nextCursor && (
              <Link
                className="text-accent"
                href={`/manage/documents?cursor=${encodeURIComponent(documentPage.pageInfo.nextCursor)}&search=${encodeURIComponent(search ?? '')}`}
              >
                More documents
              </Link>
            )}
            <span className="text-text-muted">Audience and family filters apply to this page.</span>
          </div>
        )}
      </Stack>
    </PageContainer>
  );
}
