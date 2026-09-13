'use client';

import { type JSX } from 'react';
import Link from 'next/link';
import { Layers } from 'lucide-react';
import { type MachineFamilyRow } from '@argoniq/db';
import { type ColumnDef, DataTable, EmptyState, ErrorState } from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { routes } from '../../lib/routes.js';
import { ManageListShell } from './manage-kit.js';

/**
 * Catalog Studio landing — the machine families registry, the top of the product/type
 * catalog. Rows open the family hub (its models). This is the front door to the catalog
 * every serial, document and playbook is authored against.
 */
export function FamiliesList(): JSX.Element {
  const list = trpc.management.listFamilies.useQuery();

  const columns: ColumnDef<MachineFamilyRow>[] = [
    {
      accessorKey: 'name',
      header: 'Family',
      cell: ({ row }) => (
        <Link
          href={routes.manage.modelsFamily(row.original.id)}
          className="text-text ease-out-fast hover:text-accent focus-visible:outline-focus font-medium underline-offset-4 transition-colors duration-150 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: 'key',
      header: 'Key',
      cell: ({ row }) => <span className="nums-tabular text-text-muted">{row.original.key}</span>,
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => <span className="text-text-muted">{row.original.description ?? '—'}</span>,
    },
  ];

  return (
    <ManageListShell
      title="Families"
      newHref={routes.manage.modelsFamily('new')}
      newLabel="New family"
    >
      <DataTable
        columns={columns}
        data={list.data ?? []}
        getRowId={(row) => row.id}
        caption="Machine families"
        isLoading={list.isLoading}
        error={
          list.error ? (
            <ErrorState title="Could not load catalog" description={list.error.message} />
          ) : undefined
        }
        empty={
          <EmptyState
            icon={<Layers className="size-6" aria-hidden />}
            title="No families yet"
            description="Create your first machine family to start building the catalog — models, options and manuals all hang off it."
          />
        }
      />
    </ManageListShell>
  );
}
