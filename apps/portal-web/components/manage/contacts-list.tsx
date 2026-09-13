'use client';

import { useMemo, type JSX } from 'react';
import Link from 'next/link';
import { Plus, Star, Users } from 'lucide-react';
import { CONTACT_ROLES, CONTACT_ROLE_LABELS, type ContactRole } from '@argoniq/core-domain';
import { type ContactRow } from '@argoniq/db';
import {
  Button,
  type ColumnDef,
  DataTable,
  EmptyState,
  ErrorState,
  PageSection,
  StatusDot,
  type StatusDotProps,
} from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { useWorkspaceAbility } from '../../lib/workspace-access.js';
import { routes } from '../../lib/routes.js';
import { ManageListShell } from './manage-kit.js';

const editHref = (id: string): string => `${routes.manage.contacts}/${id}`;

const nameLinkCn =
  'font-medium text-text underline-offset-4 transition-colors duration-150 ease-out-fast hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const mutedLinkCn =
  'text-text-muted underline-offset-4 transition-colors duration-150 ease-out-fast hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** The one place a role maps to a status tone (presentation only — the labels are canon in
 *  core-domain). A colored dot + label, never a chip: the house status language. */
const ROLE_TONE: Record<ContactRole, StatusDotProps['tone']> = {
  maintenance: 'warning',
  operations: 'info',
  engineering: 'info',
  management: 'success',
  procurement: 'neutral',
  quality: 'success',
  other: 'neutral',
};

/** Inline typographic status for a contact's function. */
export function ContactRoleText({ role }: { role: ContactRole }): JSX.Element {
  return <StatusDot tone={ROLE_TONE[role]} label={CONTACT_ROLE_LABELS[role]} className="text-xs" />;
}

/** Role options for the contact editor's picker (value = canon role, label = human). */
export const CONTACT_ROLE_OPTIONS = CONTACT_ROLES.map((role) => ({
  value: role,
  label: CONTACT_ROLE_LABELS[role],
}));

/**
 * Contacts table — the DRY related-list of people, shared by the standalone Contacts
 * registry, the company account hub (scoped by `companyId`), and a site record (scoped
 * by `siteId`). Columns adapt to the scope: Company shows only in the registry, and Site
 * hides once scoped to one site. The primary contact floats to the top, marked with a star.
 */
export function ContactsTable({
  companyId,
  siteId,
}: {
  companyId?: string | undefined;
  siteId?: string | undefined;
}): JSX.Element {
  const list = trpc.management.listContacts.useQuery(
    siteId ? { limit: 100, siteId } : companyId ? { limit: 100, companyId } : { limit: 100 },
  );

  const showCompany = !companyId && !siteId; // only the standalone registry needs it
  const showSite = !siteId; // registry + company record answer "which site is this person at?"

  const companiesQuery = trpc.management.listCompanies.useQuery(
    { limit: 100 },
    { enabled: showCompany },
  );
  const sitesQuery = trpc.management.listSites.useQuery(
    companyId ? { limit: 100, companyId } : { limit: 100 },
    { enabled: showSite },
  );

  const companyName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of companiesQuery.data?.items ?? []) map.set(c.id, c.name);
    return map;
  }, [companiesQuery.data]);
  const siteName = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sitesQuery.data?.items ?? []) map.set(s.id, s.name);
    return map;
  }, [sitesQuery.data]);

  // Primary first, then the service's newest-first order (a stable sort preserves it).
  const rows = useMemo(
    () => [...(list.data?.items ?? [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
    [list.data],
  );

  const columns: ColumnDef<ContactRow>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <Link href={editHref(row.original.id)} className={nameLinkCn}>
              {row.original.name}
            </Link>
            {row.original.isPrimary ? (
              <Star
                className="text-zone-amber size-3.5 shrink-0 fill-current"
                aria-label="Primary contact"
              />
            ) : null}
          </span>
          {row.original.title ? (
            <span className="text-text-muted text-xs">{row.original.title}</span>
          ) : null}
        </span>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => <ContactRoleText role={row.original.role} />,
    },
    ...(showCompany
      ? [
          {
            id: 'company',
            header: 'Company',
            cell: ({ row }) => (
              <span className="text-text-muted">
                {companyName.get(row.original.companyId) ?? '—'}
              </span>
            ),
          } as ColumnDef<ContactRow>,
        ]
      : []),
    ...(showSite
      ? [
          {
            id: 'site',
            header: 'Site',
            cell: ({ row }) =>
              row.original.siteId ? (
                <span className="text-text-muted">{siteName.get(row.original.siteId) ?? '—'}</span>
              ) : (
                <span className="text-text-muted">Company-wide</span>
              ),
          } as ColumnDef<ContactRow>,
        ]
      : []),
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) =>
        row.original.email ? (
          <a href={`mailto:${row.original.email}`} className={mutedLinkCn}>
            {row.original.email}
          </a>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) =>
        row.original.phone ? (
          <a href={`tel:${row.original.phone}`} className={`nums-tabular ${mutedLinkCn}`}>
            {row.original.phone}
          </a>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      caption="Contacts"
      isLoading={list.isLoading}
      error={
        list.error ? (
          <ErrorState title="Could not load contacts" description={list.error.message} />
        ) : undefined
      }
      empty={
        <EmptyState
          icon={<Users className="size-6" aria-hidden />}
          title="No contacts yet"
          description="Add the people you work with — maintenance, operations, management, procurement."
        />
      }
    />
  );
}

/**
 * Contacts related-list section — the company account hub and a site record both drop this
 * in. "New contact" NAVIGATES to the standalone create page pre-filled with this company
 * (and site, at a site record); never an inline form, matching the Sites/Machines sections.
 */
export function ContactsSection({
  companyId,
  siteId,
}: {
  companyId: string;
  siteId?: string | undefined;
}): JSX.Element {
  const newHref = `${routes.manage.contacts}/new?companyId=${companyId}${siteId ? `&siteId=${siteId}` : ''}`;
  const ability = useWorkspaceAbility();
  return (
    <PageSection
      title="Contacts"
      description={siteId ? 'People based at this site.' : 'People you work with at this company.'}
      actions={
        ability?.can('create', 'Contact') ? (
          <Button asChild size="sm" variant="secondary">
            <Link href={newHref}>
              <Plus className="size-4" aria-hidden />
              New contact
            </Link>
          </Button>
        ) : null
      }
    >
      <ContactsTable companyId={companyId} siteId={siteId} />
    </PageSection>
  );
}

/** Contacts registry — the standalone list page (the CRM address book across all companies). */
export function ContactsList(): JSX.Element {
  return (
    <ManageListShell
      title="Contacts"
      newHref={`${routes.manage.contacts}/new`}
      newLabel="New contact"
    >
      <ContactsTable />
    </ManageListShell>
  );
}
