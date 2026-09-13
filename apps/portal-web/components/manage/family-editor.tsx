'use client';

import { type JSX } from 'react';
import { z } from 'zod';
import { type MachineFamilyRow } from '@argoniq/db';
import { TextField, TextareaField } from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { routes } from '../../lib/routes.js';
import { ModelsSection } from './models-hub.js';
import { EditorForm, EntityLoader, useEntityEditor, useManageHandlers } from './editor-kit.js';

/**
 * Form schema (UI-level): plain strings for every field; the domain
 * `MachineFamilyCreateInput` normalizes blanks (description → undefined, iconKey →
 * null) on submit. Client-validates the same key rule the server enforces.
 */
const FamilyFormSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers and hyphens'),
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  iconKey: z.string().max(63),
});

/** Family editor / hub — create (`id === 'new'`) or edit one family + its models. `name`
 *  pre-fills the name when arriving from a "Create new family" action. */
export function FamilyEditor({ id, name }: { id: string; name?: string | undefined }): JSX.Element {
  const query = trpc.management.getFamily.useQuery({ familyId: id }, { enabled: id !== 'new' });
  return (
    <EntityLoader
      id={id}
      query={query}
      entity="Family"
      entityLabel="Models"
      listHref={routes.manage.models}
    >
      {(existing) => <FamilyForm existing={existing} defaultName={name} />}
    </EntityLoader>
  );
}

function FamilyForm({
  existing,
  defaultName,
}: {
  existing: MachineFamilyRow | null;
  defaultName?: string | undefined;
}): JSX.Element {
  const handlers = useManageHandlers({
    entity: 'Family',
    listHref: routes.manage.models,
    invalidate: (u) => u.management.listFamilies.invalidate(),
  });
  const create = trpc.management.createFamily.useMutation(handlers.saved('Family created'));
  const update = trpc.management.updateFamily.useMutation(handlers.saved('Family updated'));
  const remove = trpc.management.deleteFamily.useMutation(handlers.deleted('Family deleted'));

  const editor = useEntityEditor({
    existing,
    schema: FamilyFormSchema,
    defaults: { key: '', name: defaultName ?? '', description: '', iconKey: '' },
    fromRow: (row) => ({
      key: row.key,
      name: row.name,
      description: row.description ?? '',
      iconKey: row.iconKey ?? '',
    }),
    create,
    update,
    remove,
    toCreate: (v) => ({ key: v.key, name: v.name, description: v.description, iconKey: v.iconKey }),
    toUpdate: (row, v) => ({
      id: row.id,
      name: v.name,
      description: v.description,
      iconKey: v.iconKey,
    }),
    deleteInput: (row) => ({ id: row.id }),
  });

  return (
    <EditorForm
      editor={editor}
      title={existing ? existing.name : 'New family'}
      entityLabel="Models"
      listHref={routes.manage.models}
      createLabel="Create family"
      sectionDescription="A product family — the unit at which knowledge is authored once. Models, options and manuals all hang off it."
      deleteDescription="Removes the family. Its models must be deleted first. This cannot be undone."
      belowForm={existing ? <ModelsSection familyId={existing.id} /> : undefined}
    >
      <TextField
        control={editor.form.control}
        name="name"
        label="Name"
        placeholder="Metal AM / LPBF printers"
      />
      <TextField
        control={editor.form.control}
        name="key"
        label="Key"
        placeholder="metal-am-lpbf"
        disabled={!editor.isNew}
        description={
          editor.isNew ? 'lowercase, numbers, hyphens' : 'lowercase, numbers, hyphens · fixed'
        }
      />
      <TextareaField
        control={editor.form.control}
        name="description"
        label="Description"
        rows={2}
      />
      <TextField
        control={editor.form.control}
        name="iconKey"
        label="Icon key"
        placeholder="printer"
        description="Optional — a schematic icon used by the line diagram (printer, oven, conveyor…)."
      />
    </EditorForm>
  );
}
