'use client';

import { useMemo, type JSX } from 'react';
import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { type ContactRow, type CompanyRow } from '@argoniq/db';
import { type ColumnDef, DataTable, EmptyState, ErrorState } from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { routes } from '../../lib/routes.js';
import { ManageListShell } from './manage-kit.js';

const editHref = (id: string): string => `${routes.manage.companies}/${id}`;

/** Companies list — the OEM's company organizations, each showing its primary contact. Rows
 *  open the editor (the account hub of contacts, sites, and machines). */
export function CompaniesList(): JSX.Element {
  const list = trpc.management.listCompanies.useQuery({ limit: 100 });
  const contacts = trpc.management.listContacts.useQuery({ limit: 100 });

  const primaryByCompany = useMemo(() => {
    const map = new Map<string, ContactRow>();
    for (const c of contacts.data?.items ?? []) if (c.isPrimary) map.set(c.companyId, c);
    return map;
  }, [contacts.data]);

  const columns: ColumnDef<CompanyRow>[] = [
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
      id: 'primaryContact',
      accessorFn: (row) => {
        const contact = primaryByCompany.get(row.id);
        return contact ? `${contact.name} ${contact.email ?? ''}` : '';
      },
      header: 'Primary contact',
      cell: ({ row }) => {
        const contact = primaryByCompany.get(row.original.id);
        if (!contact) return <span className="text-text-muted">—</span>;
        return (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-text">{contact.name}</span>
            {contact.email ? (
              <span className="text-text-muted text-xs">{contact.email}</span>
            ) : null}
          </span>
        );
      },
    },
  ];

  return (
    <ManageListShell
      title="Companies"
      newHref={`${routes.manage.companies}/new`}
      newLabel="New company"
    >
      <DataTable
        columns={columns}
        data={list.data?.items ?? []}
        getRowId={(row) => row.id}
        caption="Companies"
        isLoading={list.isLoading}
        error={
          list.error ? (
            <ErrorState title="Could not load companies" description={list.error.message} />
          ) : undefined
        }
        empty={
          <EmptyState
            icon={<Building2 className="size-6" aria-hidden />}
            title="No companies yet"
            description="Add the first company organization to start building the installed base."
          />
        }
      />
    </ManageListShell>
  );
}
