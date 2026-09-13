'use client';

import { type JSX } from 'react';
import Link from 'next/link';
import { DataTable, type ColumnDef } from '@argoniq/ui';
import { routes } from '../../lib/routes.js';
import { ManageListShell } from './manage-kit.js';

type Model = { id: string; name: string; key: string; familyId: string; familyName: string };
const columns: ColumnDef<Model>[] = [
  {
    accessorKey: 'name',
    header: 'Model',
    cell: ({ row }) => (
      <Link
        className="text-accent font-medium hover:underline"
        href={routes.manage.modelsModel(row.original.id)}
      >
        {row.original.name}
      </Link>
    ),
  },
  { accessorKey: 'key', header: 'Model code' },
  {
    accessorKey: 'familyName',
    header: 'Family',
    cell: ({ row }) => (
      <Link
        className="text-accent hover:underline"
        href={routes.manage.modelsFamily(row.original.familyId)}
      >
        {row.original.familyName}
      </Link>
    ),
  },
];
export function ModelsList({ models }: { models: Model[] }): JSX.Element {
  return (
    <ManageListShell title="Models" newHref={routes.manage.modelsModel('new')} newLabel="New model">
      <Link
        className="text-accent w-fit text-sm hover:underline"
        href={`${routes.manage.models}/families`}
      >
        Browse families
      </Link>
      <DataTable columns={columns} data={models} getRowId={(m) => m.id} caption="Models" />
    </ManageListShell>
  );
}
