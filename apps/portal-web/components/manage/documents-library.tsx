'use client';

import { type JSX, type ReactNode, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { DOCUMENT_CATEGORIES, SerialId, documentCategoryLabel } from '@argoniq/core-domain';
import { type DocumentListItem } from '@argoniq/core';
import { DataTable, type ColumnDef, Select, Spinner, StatusDot, cn } from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { useWorkspacePreference } from '../../lib/use-workspace-preference.js';

/**
 * OEM Knowledge Library — three lenses on the whole corpus:
 *  • Library  — documents by product scope (family → model), with tier + health.
 *  • Coverage — models × document type, so gaps in the catalog jump out.
 *  • Resolve  — pick a serial → exactly what the assistant would use for it, with the
 *               channel each source reaches (customer / internal / restricted).
 */

type Family = { id: string; name: string };
type Model = { id: string; familyId: string; name: string };
type SerialOption = { id: string; serialNumber: string; familyId: string; modelId: string };

const TIER_META: Record<string, { label: string; title: string }> = {
  T1: { label: 'Customer manuals', title: 'Public — customer-visible & AI-citable' },
  T2: { label: 'Company-specific', title: 'Company-specific' },
  T3: { label: 'Internal', title: 'Internal — AI reasons, never disclosed' },
  T4: { label: 'Restricted', title: 'Restricted — excluded from the AI' },
};
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

type CatalogDoc = DocumentListItem & { revisionCount: number };

/** Collapse revisions of the same logical document (docKey) into one current row. */
function currentRevisions(docs: readonly DocumentListItem[]): CatalogDoc[] {
  const groups = new Map<string, DocumentListItem[]>();
  for (const d of docs) {
    const key = d.revisionGroupId;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(d);
  }
  return [...groups.values()].map((revs) => {
    const current =
      revs.find((r) => r.isCurrent) ??
      [...revs].sort((a, b) => b.revisionNumber - a.revisionNumber)[0]!;
    return { ...current, revisionCount: revs.length };
  });
}

function scopeLabel(d: {
  serialId: string | null;
  modelId: string | null;
  familyId: string | null;
  companyId: string | null;
}): string {
  if (d.serialId) return 'This machine';
  if (d.modelId) return 'Model-specific';
  if (d.familyId) return 'Family-wide';
  if (d.companyId) return 'This company';
  return 'All machines';
}

function Chip({
  children,
  title,
  className,
}: {
  children: ReactNode;
  title?: string | undefined;
  className?: string | undefined;
}): JSX.Element {
  return (
    <span
      title={title}
      className={cn('bg-surface text-text-muted shrink-0 rounded px-1.5 py-0.5 text-xs', className)}
    >
      {children}
    </span>
  );
}

function HealthCell({ state, issue }: { state: string; issue?: string | undefined }): JSX.Element {
  return (
    <span className="text-text-muted flex items-center gap-1.5" title={issue}>
      <StatusDot tone={STATE_TONE[state] ?? 'neutral'} />
      <span className="text-sm">{STATE_LABEL[state] ?? state}</span>
    </span>
  );
}

/** The three lenses on the corpus — driven by the route (sidebar sub-items), not tabs. */
export type DocumentsView = 'library' | 'coverage' | 'resolve';

export function DocumentsLibrary({
  view,
  families,
  models,
  documents,
  serials,
}: {
  view: DocumentsView;
  families: readonly Family[];
  models: readonly Model[];
  documents: readonly DocumentListItem[];
  serials: readonly SerialOption[];
}): JSX.Element {
  const docs = useMemo(
    () =>
      view === 'library'
        ? documents.map((d) => ({ ...d, revisionCount: 1 }))
        : currentRevisions(
            documents.filter(
              (d) =>
                d.publication === 'approved' &&
                !!d.effectiveFrom &&
                new Date(d.effectiveFrom) <= new Date(),
            ),
          ),
    [documents, view],
  );

  return (
    <div className="flex flex-col gap-4">
      {view === 'library' && <LibraryView docs={docs} families={families} models={models} />}
      {view === 'coverage' && <CoverageView docs={docs} families={families} models={models} />}
      {view === 'resolve' && <ResolveView serials={serials} models={models} />}
    </div>
  );
}

// ---------------------------------------------------------------- Library view
function LibraryView({
  docs,
  families,
  models,
}: {
  docs: readonly CatalogDoc[];
  families: readonly Family[];
  models: readonly Model[];
}): JSX.Element {
  const [tier, setTier] = useWorkspacePreference<string>('documents:audience', 'all');
  const [familyId, setFamilyId] = useWorkspacePreference<string>('documents:family', 'all');
  const [onlyIssues, setOnlyIssues] = useWorkspacePreference<boolean>('documents:issues', false);
  const modelName = useMemo(() => new Map(models.map((m) => [m.id, m.name])), [models]);
  const familyName = useMemo(() => new Map(families.map((f) => [f.id, f.name])), [families]);

  const filtered = docs.filter(
    (d) =>
      (tier === 'all' || d.tier === tier) &&
      (familyId === 'all' || d.familyId === familyId) &&
      (!onlyIssues || d.health.issues.some((i) => i.severity !== 'info')),
  );

  const columns: ColumnDef<CatalogDoc>[] = [
    {
      accessorKey: 'title',
      header: 'Document',
      cell: ({ row }) => (
        <Link
          href={`/technical-information/${row.original.id}`}
          className="text-accent font-medium hover:underline"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: 'publication',
      header: 'Publication',
      cell: ({ row }) => row.original.publication.replaceAll('_', ' '),
    },
    { accessorKey: 'language', header: 'Language' },
    {
      accessorKey: 'revisionLabel',
      header: 'Revision',
      cell: ({ row }) => row.original.revisionLabel ?? 'Not recorded',
    },
    {
      id: 'scope',
      header: 'Applies to',
      accessorFn: (d) =>
        d.modelId
          ? (modelName.get(d.modelId) ?? scopeLabel(d))
          : d.familyId
            ? (familyName.get(d.familyId) ?? scopeLabel(d))
            : scopeLabel(d),
    },
    {
      accessorKey: 'category',
      header: 'Type',
      cell: ({ row }) => documentCategoryLabel(row.original.category),
    },
    {
      accessorKey: 'tier',
      header: 'Audience',
      cell: ({ row }) => TIER_META[row.original.tier]?.label ?? 'Not recorded',
    },
    {
      id: 'health',
      header: 'Processing',
      accessorFn: (d) => STATE_LABEL[d.health.state] ?? d.health.state,
      cell: ({ row }) => (
        <HealthCell
          state={row.original.health.state}
          issue={row.original.health.issues[0]?.message}
        />
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="document-audience"
            className="text-text-muted mb-1 block text-xs font-medium"
          >
            Audience
          </label>
          <Select id="document-audience" value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="all">All audiences</option>
            {Object.entries(TIER_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label
            htmlFor="document-family"
            className="text-text-muted mb-1 block text-xs font-medium"
          >
            Family
          </label>
          <Select
            id="document-family"
            value={familyId}
            onChange={(e) => setFamilyId(e.target.value)}
          >
            <option value="all">All families</option>
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyIssues}
            onChange={(e) => setOnlyIssues(e.target.checked)}
          />
          Needs attention
        </label>
      </div>
      <DataTable columns={columns} data={filtered} getRowId={(d) => d.id} caption="Documents" />
    </div>
  );
}

// ---------------------------------------------------------------- Coverage view
/** A catalog (non-company) doc applies to a model if it targets the model, its family, or is global. */
function docCoversModel(d: CatalogDoc, model: Model): boolean {
  if (d.companyId) return false;
  if (d.modelId) return d.modelId === model.id;
  if (d.familyId) return d.familyId === model.familyId;
  return true;
}

function CoverageView({
  docs,
  families,
  models,
}: {
  docs: readonly CatalogDoc[];
  families: readonly Family[];
  models: readonly Model[];
}): JSX.Element {
  // Columns = the document categories actually present in the catalog (non-company docs).
  const columns = DOCUMENT_CATEGORIES.filter((cat) =>
    docs.some((d) => !d.companyId && d.category === cat),
  );
  let gaps = 0;

  const rows = families.flatMap((f) => {
    const familyModels = models.filter((m) => m.familyId === f.id);
    return familyModels.map((m) => ({ family: f, model: m }));
  });

  return (
    <div className="flex flex-col gap-3">
      <Text2 muted>
        Type-catalog documents that apply to each model (a family-wide document covers every model
        in its family). Empty cells are coverage gaps. Company-specific (T2) documents are not shown
        here.
      </Text2>
      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full min-w-160 text-sm">
          <thead>
            <tr className="border-border bg-surface border-b">
              <th className="text-text-muted px-4 py-2.5 text-left text-xs font-semibold tracking-wide uppercase">
                Model
              </th>
              {columns.map((cat) => (
                <th
                  key={cat}
                  className="text-text-muted px-3 py-2.5 text-center text-xs font-semibold tracking-wide uppercase"
                >
                  {documentCategoryLabel(cat)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ family, model }) => (
              <tr
                key={model.id}
                className="border-border ease-out-fast even:bg-surface/60 hover:bg-surface-subtle border-b transition-colors duration-150 last:border-0"
              >
                <td className="px-4 py-2.5">
                  <span className="text-text font-medium">{model.name}</span>
                  <span className="text-text-subtle ml-2 text-xs">{family.name}</span>
                </td>
                {columns.map((cat) => {
                  const cell = docs.filter((d) => d.category === cat && docCoversModel(d, model));
                  if (cell.length === 0) {
                    gaps++;
                    return (
                      <td key={cat} className="text-text-subtle px-3 py-2.5 text-center">
                        —
                      </td>
                    );
                  }
                  const worst = cell.some(
                    (d) => d.health.state === 'failed' || d.health.state === 'degraded',
                  )
                    ? 'degraded'
                    : cell.some((d) => d.health.state === 'pending')
                      ? 'pending'
                      : 'ready';
                  return (
                    <td key={cat} className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot tone={STATE_TONE[worst] ?? 'neutral'} />
                        <span className="nums-tabular text-text">{cell.length}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Text2 muted>
        {gaps} coverage gap{gaps === 1 ? '' : 's'} across {rows.length} models.
      </Text2>
    </div>
  );
}

// ---------------------------------------------------------------- Resolve view
const CHANNEL_META: Record<
  string,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral'; blurb: string }
> = {
  customer: {
    label: 'Customer-visible',
    tone: 'success',
    blurb: 'Cited to the customer and used by the assistant.',
  },
  internal: {
    label: 'Internal only',
    tone: 'warning',
    blurb: 'The assistant may reason over it, but never discloses or cites it.',
  },
  restricted: {
    label: 'Restricted',
    tone: 'danger',
    blurb: 'Credential-isolated — excluded from the assistant entirely.',
  },
  reference: {
    label: 'Reference only',
    tone: 'neutral',
    blurb: 'Catalogued and downloadable, but not read by the assistant (backup / CAD).',
  },
};

function ResolveView({
  serials,
  models,
}: {
  serials: readonly SerialOption[];
  models: readonly Model[];
}): JSX.Element {
  const [serialId, setSerialId] = useState<string>('');
  const modelName = useMemo(() => new Map(models.map((m) => [m.id, m.name])), [models]);
  const parsed = SerialId.safeParse(serialId);
  const preview = trpc.document.previewApplicability.useQuery(
    {
      serialId: parsed.success
        ? parsed.data
        : SerialId.parse('00000000-0000-4000-8000-000000000000'),
    },
    { enabled: parsed.success },
  );

  const previewDocs = preview.data?.documents;
  const byChannel = useMemo(() => {
    const map: Record<string, NonNullable<typeof previewDocs>[number][]> = {
      customer: [],
      internal: [],
      restricted: [],
      reference: [],
    };
    for (const d of previewDocs ?? []) map[d.channel]!.push(d);
    return map;
  }, [previewDocs]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Text2 muted>Show what the assistant would use for</Text2>
        <div className="w-72">
          <Select
            aria-label="Machine to check document coverage"
            value={serialId}
            onChange={(e) => setSerialId(e.target.value)}
          >
            <option value="">Select a machine…</option>
            {serials.map((s) => (
              <option key={s.id} value={s.id}>
                {s.serialNumber}
                {modelName.get(s.modelId) ? ` — ${modelName.get(s.modelId)}` : ''}
              </option>
            ))}
          </Select>
        </div>
        {preview.isFetching && <Spinner />}
      </div>

      {!parsed.success ? (
        <Text2 muted>Pick a machine to preview its resolved knowledge.</Text2>
      ) : preview.data?.documents.length === 0 ? (
        <Text2 muted>No documents currently apply to this machine.</Text2>
      ) : (
        (['customer', 'internal', 'restricted', 'reference'] as const).map((ch) => {
          const list = byChannel[ch] ?? [];
          const meta = CHANNEL_META[ch]!;
          return list.length === 0 ? null : (
            <div key={ch} className="border-border overflow-hidden rounded-lg border">
              <div className="border-border bg-surface-subtle flex items-center gap-2 border-b px-4 py-2">
                <StatusDot tone={meta.tone} />
                <span className="text-text text-sm font-medium">{meta.label}</span>
                <span className="text-text-subtle text-xs">{meta.blurb}</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {list.map((d) => (
                    <tr
                      key={d.id}
                      className="border-border ease-out-fast even:bg-surface/60 hover:bg-surface-subtle border-b transition-colors duration-150 last:border-0"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/technical-information/${d.id}`}
                          className="text-text hover:text-accent flex items-center gap-2 font-medium"
                        >
                          <FileText className="text-text-subtle size-4 shrink-0" aria-hidden />
                          <span className="truncate">{d.title}</span>
                          {d.revisionLabel && (
                            <span className="text-text-subtle shrink-0 text-xs">
                              Rev {d.revisionLabel}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="text-text-muted px-2 py-2.5">{d.scope}</td>
                      <td className="px-2 py-2.5">
                        <Chip title={TIER_META[d.tier]?.title}>
                          {TIER_META[d.tier]?.label ?? d.tier}
                        </Chip>
                      </td>
                      <td className="px-4 py-2.5">
                        <HealthCell state={d.health.state} issue={d.health.issues[0]?.message} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}

/** Small muted paragraph (local — avoids threading the UI `Text` import through every helper). */
function Text2({ children, muted }: { children: ReactNode; muted?: boolean }): JSX.Element {
  return <p className={cn('text-sm', muted ? 'text-text-muted' : 'text-text')}>{children}</p>;
}
