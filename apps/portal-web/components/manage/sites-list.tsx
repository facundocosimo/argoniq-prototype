'use client';

import { useMemo, type JSX } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { type SiteRow } from '@argoniq/db';
import { type ColumnDef, DataTable, EmptyState, ErrorState } from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { routes } from '../../lib/routes.js';
import { flagEmoji } from '../../lib/countries.js';
import { ManageListShell } from './manage-kit.js';

const editHref = (id: string): string => `${routes.manage.sites}/${id}`;

/**
 * Sites table — the DRY related-list of sites, shared by the standalone Sites registry
 * and (scoped by `companyId`) the company account hub. The Company column is hidden
 * when the table is already scoped to one company.
 */
export function SitesTable({ companyId }: { companyId?: string | undefined }): JSX.Element {
  const list = trpc.management.listSites.useQuery(
    companyId ? { limit: 100, companyId } : { limit: 100 },
  );
  const companies = trpc.management.listCompanies.useQuery({ limit: 100 }, { enabled: !companyId });

  const companyName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of companies.data?.items ?? []) map.set(c.id, c.name);
    return map;
  }, [companies.data]);

  const columns: ColumnDef<SiteRow>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link
          href={editHref(row.original.id)}
          className="text-text ease-out-fast hover:text-accent focus-visible:outline-focus font-medium underline-offset-4 transition-colors duration-150 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {row.original.name}
        </Link>
      ),
    },
    ...(companyId
      ? []
      : [
          {
            id: 'company',
            header: 'Company',
            cell: ({ row }) => (
              <span className="text-text-muted">
                {companyName.get(row.original.companyId) ?? '—'}
              </span>
            ),
          } as ColumnDef<SiteRow>,
        ]),
    {
      accessorKey: 'countryCode',
      header: 'Country',
      cell: ({ row }) =>
        row.original.countryCode ? (
          <span className="nums-tabular text-text-muted flex items-center gap-1.5">
            <span aria-hidden>{flagEmoji(row.original.countryCode)}</span>
            {row.original.countryCode}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={list.data?.items ?? []}
      getRowId={(row) => row.id}
      caption="Sites"
      isLoading={list.isLoading}
      error={
        list.error ? (
          <ErrorState title="Could not load sites" description={list.error.message} />
        ) : undefined
      }
      empty={
        <EmptyState
          icon={<MapPin className="size-6" aria-hidden />}
          title="No sites yet"
          description="Add a site to record where machines are installed."
        />
      }
    />
  );
}

/** Sites registry — the standalone list page. */
export function SitesList(): JSX.Element {
  return (
    <ManageListShell title="Sites" newHref={`${routes.manage.sites}/new`} newLabel="New site">
      <SitesTable />
    </ManageListShell>
  );
}
