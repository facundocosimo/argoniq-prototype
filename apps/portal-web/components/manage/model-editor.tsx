'use client';

import { type JSX } from 'react';
import { z } from 'zod';
import { type MachineModelRow } from '@argoniq/db';
import { ErrorState, TextField, TextareaField } from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { routes } from '../../lib/routes.js';
import { ModelConfigSections } from './models-hub.js';
import { ManageEditorShell } from './manage-kit.js';
import { EditorForm, EntityLoader, useEntityEditor, useManageHandlers } from './editor-kit.js';

/** Form schema (UI-level): plain strings; the domain input normalizes blanks on submit. */
const ModelFormSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers and hyphens'),
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  imageUrl: z
    .string()
    .max(1024)
    .refine((v) => v === '' || z.string().url().safeParse(v).success, {
      message: 'Enter a valid URL or leave blank.',
    }),
});

/**
 * Model editor / hub — create (`id === 'new'`, family from `?familyId=`) or edit one
 * model plus its variant axes and option catalog. Back/cancel returns to the owning
 * family hub, so drilling into the catalog never loses the parent trail.
 */
export function ModelEditor({
  id,
  familyId,
  name,
}: {
  id: string;
  familyId?: string | undefined;
  name?: string | undefined;
}): JSX.Element {
  const isNew = id === 'new';
  const query = trpc.management.getModel.useQuery({ modelId: id }, { enabled: !isNew });

  if (isNew && !familyId) {
    return (
      <ManageEditorShell
        title="New model"
        entityLabel="Models"
        listHref={routes.manage.models}
        current="New"
      >
        <ErrorState
          title="No family selected"
          description="Open the machine catalog and pick a family first."
        />
      </ManageEditorShell>
    );
  }

  return (
    <EntityLoader
      id={id}
      query={query}
      entity="Model"
      entityLabel="Models"
      listHref={routes.manage.models}
    >
      {(existing) => (
        <ModelForm
          existing={existing}
          familyId={existing ? existing.familyId : familyId!}
          defaultName={name}
        />
      )}
    </EntityLoader>
  );
}

function ModelForm({
  existing,
  familyId,
  defaultName,
}: {
  existing: MachineModelRow | null;
  familyId: string;
  defaultName?: string | undefined;
}): JSX.Element {
  const listHref = routes.manage.modelsFamily(familyId);
  const handlers = useManageHandlers({
    entity: 'Model',
    listHref,
    invalidate: (u) => u.management.listModels.invalidate({ familyId }),
  });
  const create = trpc.management.createModel.useMutation(handlers.saved('Model created'));
  const update = trpc.management.updateModel.useMutation(handlers.saved('Model updated'));
  const remove = trpc.management.deleteModel.useMutation(handlers.deleted('Model deleted'));

  const editor = useEntityEditor({
    existing,
    schema: ModelFormSchema,
    defaults: { key: '', name: defaultName ?? '', description: '', imageUrl: '' },
    fromRow: (row) => ({
      key: row.key,
      name: row.name,
      description: row.description ?? '',
      imageUrl: row.imageUrl ?? '',
    }),
    create,
    update,
    remove,
    toCreate: (v) => ({
      familyId,
      key: v.key,
      name: v.name,
      description: v.description,
      imageUrl: v.imageUrl,
    }),
    toUpdate: (row, v) => ({
      id: row.id,
      name: v.name,
      description: v.description,
      imageUrl: v.imageUrl,
    }),
    deleteInput: (row) => ({ id: row.id }),
  });

  return (
    <EditorForm
      editor={editor}
      title={existing ? existing.name : 'New model'}
      entityLabel="Models"
      listHref={listHref}
      createLabel="Create model"
      sectionDescription="A model within the family (e.g. “Atlas Training Cell”). Its variant axes and options define what a serial can be built as."
      deleteDescription="Removes the model, its variant axes and its option catalog. Machines must be removed first. This cannot be undone."
      belowForm={existing ? <ModelConfigSections modelId={existing.id} /> : undefined}
    >
      <TextField
        control={editor.form.control}
        name="name"
        label="Name"
        placeholder="Atlas Training Cell"
      />
      <TextField
        control={editor.form.control}
        name="key"
        label="Key"
        placeholder="atlas-training"
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
        name="imageUrl"
        label="Image URL"
        placeholder="https://…/atlas-training.png"
        description="Optional — a canonical product image shown for every serial of this model."
      />
    </EditorForm>
  );
}
