'use client';

import { useMemo, type JSX } from 'react';
import Link from 'next/link';
import { Cpu } from 'lucide-react';
import { type SerialRow } from '@argoniq/db';
import { type ColumnDef, DataTable, EmptyState, ErrorState } from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { routes } from '../../lib/routes.js';
import { SerialStatusText } from '../serial-status.js';
import { ManageListShell } from './manage-kit.js';

const editHref = routes.serial;

/**
 * Machines table — the DRY related-list of installed serials, shared by the standalone
 * Machines registry and (scoped by `companyId`) the company account hub. The Company
 * column is hidden when scoped to one company.
 */
export function MachinesTable({ companyId }: { companyId?: string | undefined }): JSX.Element {
  const list = trpc.machine.listSerials.useQuery(
    companyId ? { limit: 100, companyId } : { limit: 100 },
  );
  const companies = trpc.management.listCompanies.useQuery({ limit: 100 }, { enabled: !companyId });

  const companyName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of companies.data?.items ?? []) map.set(c.id, c.name);
    return map;
  }, [companies.data]);

  const columns: ColumnDef<SerialRow>[] = [
    {
      accessorKey: 'serialNumber',
      header: 'Serial number',
      cell: ({ row }) => (
        <Link
          href={editHref(row.original.id)}
          className="nums-tabular text-text ease-out-fast hover:text-accent focus-visible:outline-focus font-medium underline-offset-4 transition-colors duration-150 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {row.original.serialNumber}
        </Link>
      ),
    },
    ...(companyId
      ? []
      : [
          {
            id: 'company',
            accessorFn: (row: SerialRow) => companyName.get(row.companyId) ?? '',
            header: 'Company',
            cell: ({ row }) => (
              <Link
                href={`${routes.manage.companies}/${row.original.companyId}`}
                className="text-accent hover:underline"
              >
                {companyName.get(row.original.companyId) ?? '—'}
              </Link>
            ),
          } as ColumnDef<SerialRow>,
        ]),
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <SerialStatusText status={row.original.status} />,
    },
    {
      accessorKey: 'firmwareVersion',
      header: 'Firmware',
      cell: ({ row }) => (
        <span className="nums-tabular text-text-muted">{row.original.firmwareVersion ?? '—'}</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={list.data?.items ?? []}
      getRowId={(row) => row.id}
      caption="Installed machines"
      isLoading={list.isLoading}
      error={
        list.error ? (
          <ErrorState title="Could not load machines" description={list.error.message} />
        ) : undefined
      }
      empty={
        <EmptyState
          icon={<Cpu className="size-6" aria-hidden />}
          title="No machines yet"
          description="Register the first installed machine."
        />
      }
    />
  );
}

/** Machines registry — the standalone list page. */
export function MachinesList(): JSX.Element {
  return (
    <ManageListShell
      title="Machines"
      newHref={`${routes.manage.machines}/new`}
      newLabel="New machine"
    >
      <MachinesTable />
    </ManageListShell>
  );
}
