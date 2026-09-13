'use client';

import { type JSX } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { SiteCreateInput } from '@argoniq/core-domain';
import { type SiteRow } from '@argoniq/db';
import { ComboboxField, FieldGrid, TextField } from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { routes } from '../../lib/routes.js';
import { COUNTRY_OPTIONS } from '../../lib/countries.js';
import { ContactsSection } from './contacts-list.js';
import { EditorForm, EntityLoader, useEntityEditor, useManageHandlers } from './editor-kit.js';

/**
 * Site editor page — create (`id === 'new'`) or edit one site. `companyId` pre-selects
 * the owning company and `name` pre-fills the site name when arriving from a "Create new
 * site" action (the company's account hub, or a machine editor's site picker).
 */
export function SiteEditor({
  id,
  companyId,
  name,
}: {
  id: string;
  companyId?: string | undefined;
  name?: string | undefined;
}): JSX.Element {
  const query = trpc.management.getSite.useQuery({ siteId: id }, { enabled: id !== 'new' });
  return (
    <EntityLoader
      id={id}
      query={query}
      entity="Site"
      entityLabel="Sites"
      listHref={routes.manage.sites}
    >
      {(existing) => (
        <SiteForm existing={existing} defaultCompanyId={companyId} defaultName={name} />
      )}
    </EntityLoader>
  );
}

function SiteForm({
  existing,
  defaultCompanyId,
  defaultName,
}: {
  existing: SiteRow | null;
  defaultCompanyId?: string | undefined;
  defaultName?: string | undefined;
}): JSX.Element {
  const router = useRouter();
  const companies = trpc.management.listCompanies.useQuery({ limit: 100 });
  const handlers = useManageHandlers({
    entity: 'Site',
    listHref: routes.manage.sites,
    invalidate: (u) => u.management.listSites.invalidate(),
  });
  const create = trpc.management.createSite.useMutation(handlers.saved('Site created'));
  const update = trpc.management.updateSite.useMutation(handlers.saved('Site updated'));
  const remove = trpc.management.deleteSite.useMutation(handlers.deleted('Site deleted'));

  const editor = useEntityEditor({
    existing,
    schema: SiteCreateInput,
    defaults: {
      companyId: defaultCompanyId ?? '',
      name: defaultName ?? '',
      countryCode: '',
      timezone: '',
    },
    fromRow: (row) => ({
      companyId: row.companyId,
      name: row.name,
      countryCode: row.countryCode ?? '',
      timezone: row.timezone ?? '',
    }),
    create,
    update,
    remove,
    toCreate: (v) => v,
    toUpdate: (row, v) => ({
      id: row.id,
      name: v.name,
      countryCode: v.countryCode,
      timezone: v.timezone,
    }),
    deleteInput: (row) => ({ id: row.id }),
  });

  const companyOptions = (companies.data?.items ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <EditorForm
      editor={editor}
      title={existing ? existing.name : 'New site'}
      entityLabel="Sites"
      listHref={routes.manage.sites}
      createLabel="Create site"
      sectionDescription="A company location where machines are installed."
      deleteDescription="Removes the site. Machines installed here must be moved or removed first. This cannot be undone."
      belowForm={
        existing ? (
          <ContactsSection companyId={existing.companyId} siteId={existing.id} />
        ) : undefined
      }
    >
      <ComboboxField
        control={editor.form.control}
        name="companyId"
        label="Company"
        placeholder="Select a company…"
        searchPlaceholder="Search companies…"
        options={companyOptions}
        loading={companies.isLoading}
        disabled={!editor.isNew}
        onCreate={
          editor.isNew
            ? (value) =>
                router.push(
                  `${routes.manage.companies}/new${value ? `?name=${encodeURIComponent(value)}` : ''}`,
                )
            : undefined
        }
        createLabel={(q) => (q ? `Create company “${q}”` : 'Create new company')}
        description={
          editor.isNew ? 'Search, or create a new company.' : 'A site’s company cannot be changed.'
        }
      />
      <TextField control={editor.form.control} name="name" label="Name" placeholder="Turin plant" />
      <FieldGrid>
        <ComboboxField
          control={editor.form.control}
          name="countryCode"
          label="Country"
          placeholder="Select a country…"
          searchPlaceholder="Search countries…"
          options={COUNTRY_OPTIONS}
        />
        <TextField
          control={editor.form.control}
          name="timezone"
          label="Timezone"
          placeholder="Europe/Rome"
          description="Optional"
        />
      </FieldGrid>
    </EditorForm>
  );
}
