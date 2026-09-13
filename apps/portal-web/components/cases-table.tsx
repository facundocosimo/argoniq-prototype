'use client';

import { type JSX } from 'react';
import { useWorkspacePreference } from '../lib/use-workspace-preference.js';
import Link from 'next/link';
import { CASE_STATUS_LABEL, type CaseStatus } from '@argoniq/core-domain';
import { DataTable, type ColumnDef, StatusDot, Select } from '@argoniq/ui';
import { routes } from '../lib/routes.js';

type ServiceCase = {
  id: string;
  reference: string;
  status: CaseStatus;
  summary: string;
  createdAt: Date;
};
const TONE = {
  open: 'info',
  in_progress: 'info',
  awaiting_customer: 'warning',
  resolved: 'success',
  closed: 'neutral',
} as const;

export function CasesTable({
  cases,
  customer = false,
}: {
  cases: readonly ServiceCase[];
  customer?: boolean;
}): JSX.Element {
  const [view, setView] = useWorkspacePreference<string>('cases:view', 'all');
  const columns: ColumnDef<ServiceCase>[] = [
    {
      accessorKey: 'reference',
      header: customer ? 'Request' : 'Case',
      cell: ({ row }) => (
        <Link
          href={`${routes.cases}/${row.original.id}`}
          className="text-accent font-mono hover:underline"
        >
          {row.original.reference}
        </Link>
      ),
    },
    {
      accessorKey: 'summary',
      header: 'Summary',
      cell: ({ row }) => <span className="line-clamp-2 max-w-prose">{row.original.summary}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusDot
          tone={TONE[row.original.status]}
          label={
            customer && row.original.status === 'awaiting_customer'
              ? 'Awaiting you'
              : CASE_STATUS_LABEL[row.original.status]
          }
        />
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Opened',
      cell: ({ row }) => (
        <span className="nums-tabular text-text-muted">
          {new Date(row.original.createdAt).toISOString().slice(0, 10)}
        </span>
      ),
    },
  ];
  const filtered = cases.filter(
    (record) =>
      view === 'all' ||
      (view === 'open' ? !['resolved', 'closed'].includes(record.status) : record.status === view),
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="max-w-xs">
        <label htmlFor="case-view" className="text-text-muted mb-1 block text-xs font-medium">
          View
        </label>
        <Select id="case-view" value={view} onChange={(event) => setView(event.target.value)}>
          <option value="all">All {customer ? 'requests' : 'cases'}</option>
          <option value="open">Open work</option>
          <option value="awaiting_customer">
            {customer ? 'Awaiting you' : 'Awaiting customer'}
          </option>
          <option value="resolved">Resolved</option>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        getRowId={(row) => row.id}
        caption={customer ? 'Support requests' : 'Cases'}
      />
    </div>
  );
}
