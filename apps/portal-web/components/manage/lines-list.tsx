'use client';

import { type JSX } from 'react';
import Link from 'next/link';
import { Workflow } from 'lucide-react';
import { type InstallationKind } from '@argoniq/core-domain';
import { type ColumnDef, DataTable, EmptyState, ErrorState } from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { routes } from '../../lib/routes.js';
import { ManageListShell } from './manage-kit.js';

const KIND_LABEL: Record<InstallationKind, string> = {
  line: 'Line',
  cell: 'Cell',
  skid: 'Skid',
  system: 'System',
};
type LineItem = {
  id: string;
  key: string;
  name: string;
  kind: InstallationKind;
  stationCount: number;
};
const editHref = (id: string): string => `${routes.manage.lines}/${id}`;

/** Lines list — production lines / cells. Rows open the editor page. */
export function LinesList(): JSX.Element {
  const list = trpc.installation.list.useQuery({});

  const columns: ColumnDef<LineItem>[] = [
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
    {
      accessorKey: 'kind',
      header: 'Type',
      cell: ({ row }) => <span className="text-text-muted">{KIND_LABEL[row.original.kind]}</span>,
    },
    {
      accessorKey: 'stationCount',
      header: 'Stations',
      cell: ({ row }) => (
        <span className="nums-tabular text-text-muted">{row.original.stationCount}</span>
      ),
    },
  ];

  return (
    <ManageListShell title="Lines" newHref={`${routes.manage.lines}/new`} newLabel="New line">
      <DataTable
        columns={columns}
        data={list.data ?? []}
        getRowId={(row) => row.id}
        caption="Lines"
        isLoading={list.isLoading}
        error={
          list.error ? (
            <ErrorState title="Could not load lines" description={list.error.message} />
          ) : undefined
        }
        empty={
          <EmptyState
            icon={<Workflow className="size-6" aria-hidden />}
            title="No lines yet"
            description="Create a line, then assign its stations."
          />
        }
      />
    </ManageListShell>
  );
}
