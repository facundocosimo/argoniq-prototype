'use client';

import { type JSX } from 'react';
import { CompanyCreateInput } from '@argoniq/core-domain';
import { type CompanyRow } from '@argoniq/db';
import { TextField } from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { routes } from '../../lib/routes.js';
import { CompanyAccount } from './company-account.js';
import { EditorForm, EntityLoader, useEntityEditor, useManageHandlers } from './editor-kit.js';

/** Company editor page — create (`id === 'new'`) or edit one company. `name` pre-fills the
 *  name from a "Create new company" action. A company's identity is just its name; its
 *  people, sites, and machines live in the account hub below (on edit). */
export function CompanyEditor({
  id,
  name,
}: {
  id: string;
  name?: string | undefined;
}): JSX.Element {
  const query = trpc.management.getCompany.useQuery({ companyId: id }, { enabled: id !== 'new' });
  return (
    <EntityLoader
      id={id}
      query={query}
      entity="Company"
      entityLabel="Companies"
      listHref={routes.manage.companies}
    >
      {(existing) => <CompanyForm existing={existing} defaultName={name} />}
    </EntityLoader>
  );
}

function CompanyForm({
  existing,
  defaultName,
}: {
  existing: CompanyRow | null;
  defaultName?: string | undefined;
}): JSX.Element {
  const handlers = useManageHandlers({
    entity: 'Company',
    listHref: routes.manage.companies,
    invalidate: (u) => u.management.listCompanies.invalidate(),
  });
  const create = trpc.management.createCompany.useMutation(handlers.saved('Company created'));
  const update = trpc.management.updateCompany.useMutation(handlers.saved('Company updated'));
  const remove = trpc.management.deleteCompany.useMutation(handlers.deleted('Company deleted'));

  const editor = useEntityEditor({
    existing,
    schema: CompanyCreateInput,
    defaults: { name: defaultName ?? '' },
    fromRow: (row) => ({ name: row.name }),
    create,
    update,
    remove,
    toCreate: (v) => v,
    toUpdate: (row, v) => ({ id: row.id, ...v }),
    deleteInput: (row) => ({ id: row.id }),
  });

  return (
    <EditorForm
      editor={editor}
      title={existing ? existing.name : 'New company'}
      entityLabel="Companies"
      listHref={routes.manage.companies}
      createLabel="Create company"
      sectionDescription="A company organization you support."
      deleteDescription="Removes the company and its sites and contacts. Machines must be removed first. This cannot be undone."
      belowForm={existing ? <CompanyAccount companyId={existing.id} /> : undefined}
    >
      <TextField
        control={editor.form.control}
        name="name"
        label="Name"
        placeholder="Acme Additive"
      />
    </EditorForm>
  );
}
