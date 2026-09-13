'use client';

import { type JSX } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { ContactCreateInput } from '@argoniq/core-domain';
import { type ContactRow } from '@argoniq/db';
import { ComboboxField, type ComboboxOption, FieldGrid, SwitchField, TextField } from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { routes } from '../../lib/routes.js';
import { countryName, flagEmoji } from '../../lib/countries.js';
import { CONTACT_ROLE_OPTIONS } from './contacts-list.js';
import { EditorForm, EntityLoader, useEntityEditor, useManageHandlers } from './editor-kit.js';

/**
 * Contact editor page — create (`id === 'new'`) or edit one contact. `companyId` (and
 * optionally `siteId`) pre-select the owner when arriving from a company or site record;
 * `name` pre-fills the name from a "Create new contact" action.
 */
export function ContactEditor({
  id,
  companyId,
  siteId,
  name,
}: {
  id: string;
  companyId?: string | undefined;
  siteId?: string | undefined;
  name?: string | undefined;
}): JSX.Element {
  const query = trpc.management.getContact.useQuery({ contactId: id }, { enabled: id !== 'new' });
  return (
    <EntityLoader
      id={id}
      query={query}
      entity="Contact"
      entityLabel="Contacts"
      listHref={routes.manage.contacts}
    >
      {(existing) => (
        <ContactForm
          existing={existing}
          defaultCompanyId={companyId}
          defaultSiteId={siteId}
          defaultName={name}
        />
      )}
    </EntityLoader>
  );
}

function ContactForm({
  existing,
  defaultCompanyId,
  defaultSiteId,
  defaultName,
}: {
  existing: ContactRow | null;
  defaultCompanyId?: string | undefined;
  defaultSiteId?: string | undefined;
  defaultName?: string | undefined;
}): JSX.Element {
  const router = useRouter();
  const companies = trpc.management.listCompanies.useQuery({ limit: 100 });
  const handlers = useManageHandlers({
    entity: 'Contact',
    listHref: routes.manage.contacts,
    invalidate: (u) => u.management.listContacts.invalidate(),
  });
  const create = trpc.management.createContact.useMutation(handlers.saved('Contact created'));
  const update = trpc.management.updateContact.useMutation(handlers.saved('Contact updated'));
  const remove = trpc.management.deleteContact.useMutation(handlers.deleted('Contact deleted'));

  const editor = useEntityEditor({
    existing,
    schema: ContactCreateInput,
    defaults: {
      companyId: defaultCompanyId ?? '',
      siteId: defaultSiteId ?? '',
      name: defaultName ?? '',
      title: '',
      role: 'other',
      email: '',
      phone: '',
      isPrimary: false,
    },
    fromRow: (row) => ({
      companyId: row.companyId,
      siteId: row.siteId ?? '',
      name: row.name,
      title: row.title ?? '',
      role: row.role,
      email: row.email ?? '',
      phone: row.phone ?? '',
      isPrimary: row.isPrimary,
    }),
    create,
    update,
    remove,
    toCreate: (v) => v,
    toUpdate: (row, v) => ({
      id: row.id,
      siteId: v.siteId,
      name: v.name,
      title: v.title,
      role: v.role,
      email: v.email,
      phone: v.phone,
      isPrimary: v.isPrimary,
    }),
    deleteInput: (row) => ({ id: row.id }),
  });

  const selectedCompanyId = editor.form.watch('companyId');
  const sites = trpc.management.listSites.useQuery(
    { limit: 100, companyId: selectedCompanyId || undefined },
    { enabled: Boolean(selectedCompanyId) },
  );

  const companyOptions: ComboboxOption[] = (companies.data?.items ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));
  // A blank first option is the explicit way to choose "no site" (a company-wide contact),
  // so a site once chosen can be cleared again.
  const siteOptions: ComboboxOption[] = [
    { value: '', label: 'Company-wide (no site)' },
    ...(sites.data?.items ?? []).map((s) => ({
      value: s.id,
      label: s.name,
      description: countryName(s.countryCode) || undefined,
      leading: flagEmoji(s.countryCode) || undefined,
    })),
  ];

  return (
    <EditorForm
      editor={editor}
      title={existing ? existing.name : 'New contact'}
      entityLabel="Contacts"
      listHref={routes.manage.contacts}
      createLabel="Create contact"
      sectionDescription="A person at a company — their role, where they’re based, and how to reach them."
      deleteDescription="Removes this contact. This cannot be undone."
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
        onValueChange={() => editor.form.setValue('siteId', '', { shouldDirty: true })}
        description={
          editor.isNew
            ? 'Search, or create a new company.'
            : 'A contact’s company cannot be changed.'
        }
      />
      <TextField control={editor.form.control} name="name" label="Name" placeholder="Marco Rossi" />
      <FieldGrid>
        <TextField
          control={editor.form.control}
          name="title"
          label="Job title"
          placeholder="Maintenance Manager"
          description="Optional"
        />
        <ComboboxField
          control={editor.form.control}
          name="role"
          label="Role"
          searchable={false}
          options={CONTACT_ROLE_OPTIONS}
        />
      </FieldGrid>
      <FieldGrid>
        <TextField
          control={editor.form.control}
          name="email"
          label="Email"
          type="email"
          placeholder="marco.rossi@borealis.example"
        />
        <TextField
          control={editor.form.control}
          name="phone"
          label="Phone"
          type="tel"
          placeholder="+39 011 555 0100"
        />
      </FieldGrid>
      <ComboboxField
        control={editor.form.control}
        name="siteId"
        label="Site"
        placeholder={selectedCompanyId ? 'Company-wide (no site)' : 'Pick a company first'}
        searchPlaceholder="Search sites…"
        options={siteOptions}
        loading={Boolean(selectedCompanyId) && sites.isLoading}
        disabled={!selectedCompanyId}
        description="Optional — leave company-wide for a contact not tied to one location."
      />
      <SwitchField
        control={editor.form.control}
        name="isPrimary"
        label="Primary contact"
        description="The main point of contact for this company. Setting this clears any existing primary."
      />
    </EditorForm>
  );
}
