'use client';

import { type JSX } from 'react';
import { z } from 'zod';
import { OPTION_TYPES, OptionType } from '@argoniq/core-domain';
import { type OptionDefRow } from '@argoniq/db';
import { ComboboxField, ErrorState, SwitchField, TextField, TextareaField } from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { routes } from '../../lib/routes.js';
import { ManageEditorShell } from './manage-kit.js';
import { EditorForm, EntityLoader, useEntityEditor, useManageHandlers } from './editor-kit.js';

const TYPE_LABEL: Record<OptionType, string> = {
  boolean: 'Yes / no module',
  choice: 'Choice',
  quantity: 'Quantity',
};

/**
 * Form schema (UI-level): `choices` is entered as a comma-separated string here and
 * split into the array the API expects on submit. Client-validates the same "a
 * choice option needs values" rule the server enforces, so the error shows inline.
 */
const OptionFormSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9_]*$/, 'lowercase_with_underscores'),
    label: z.string().min(1).max(200),
    optionType: OptionType,
    choicesText: z.string().max(500),
    unit: z.string().max(32),
    safetyRelevant: z.boolean(),
    description: z.string().max(2000),
  })
  .superRefine((value, ctx) => {
    if (value.optionType === 'choice' && splitChoices(value.choicesText).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choicesText'],
        message: 'Add at least one allowed value.',
      });
    }
  });

function splitChoices(text: string): string[] {
  return text
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Option editor page — create (`id === 'new'`, model from `?modelId=`) or edit. */
export function OptionEditor({
  id,
  modelId,
}: {
  id: string;
  modelId?: string | undefined;
}): JSX.Element {
  const isNew = id === 'new';
  const query = trpc.management.getOptionDef.useQuery({ optionDefId: id }, { enabled: !isNew });

  if (isNew && !modelId) {
    return (
      <ManageEditorShell
        title="New option"
        entityLabel="Models"
        listHref={routes.manage.models}
        current="New"
      >
        <ErrorState
          title="No model selected"
          description="Open a model in the catalog and add the option from there."
        />
      </ManageEditorShell>
    );
  }

  return (
    <EntityLoader
      id={id}
      query={query}
      entity="Option"
      entityLabel="Models"
      listHref={routes.manage.models}
    >
      {(existing) => (
        <OptionForm existing={existing} modelId={existing ? existing.modelId : modelId!} />
      )}
    </EntityLoader>
  );
}

function OptionForm({
  existing,
  modelId,
}: {
  existing: OptionDefRow | null;
  modelId: string;
}): JSX.Element {
  const listHref = routes.manage.modelsModel(modelId);
  const handlers = useManageHandlers({
    entity: 'Option',
    listHref,
    invalidate: (u) => u.management.listOptionDefs.invalidate({ modelId }),
  });
  const create = trpc.management.createOptionDef.useMutation(handlers.saved('Option added'));
  const update = trpc.management.updateOptionDef.useMutation(handlers.saved('Option updated'));
  const remove = trpc.management.deleteOptionDef.useMutation(handlers.deleted('Option removed'));

  const editor = useEntityEditor({
    existing,
    schema: OptionFormSchema,
    defaults: {
      key: '',
      label: '',
      optionType: 'boolean',
      choicesText: '',
      unit: '',
      safetyRelevant: false,
      description: '',
    },
    fromRow: (row) => ({
      key: row.key,
      label: row.label,
      optionType: row.optionType,
      choicesText: (row.choices ?? []).join(', '),
      unit: row.unit ?? '',
      safetyRelevant: row.safetyRelevant,
      description: row.description ?? '',
    }),
    create,
    update,
    remove,
    toCreate: (v) => ({
      modelId,
      key: v.key,
      label: v.label,
      optionType: v.optionType,
      choices: v.optionType === 'choice' ? splitChoices(v.choicesText) : undefined,
      unit: v.optionType === 'quantity' ? v.unit : undefined,
      safetyRelevant: v.safetyRelevant,
      description: v.description,
    }),
    toUpdate: (row, v) => ({
      id: row.id,
      label: v.label,
      optionType: v.optionType,
      choices: v.optionType === 'choice' ? splitChoices(v.choicesText) : undefined,
      unit: v.optionType === 'quantity' ? v.unit : undefined,
      safetyRelevant: v.safetyRelevant,
      description: v.description,
    }),
    deleteInput: (row) => ({ id: row.id }),
  });

  const optionType = editor.form.watch('optionType');

  return (
    <EditorForm
      editor={editor}
      title={existing ? existing.label : 'New option'}
      entityLabel="Models"
      listHref={listHref}
      createLabel="Add option"
      sectionDescription="An installable module for this model."
      deleteDescription="Machines’ selections for this option are removed too. This cannot be undone."
    >
      <TextField
        control={editor.form.control}
        name="label"
        label="Label"
        placeholder="Explosion (ATEX) kit"
      />
      <TextField
        control={editor.form.control}
        name="key"
        label="Key"
        placeholder="explosion_kit"
        disabled={!editor.isNew}
        description={
          editor.isNew ? 'lowercase_with_underscores' : 'lowercase_with_underscores · fixed'
        }
      />
      <ComboboxField
        control={editor.form.control}
        name="optionType"
        label="Type"
        searchable={false}
        options={OPTION_TYPES.map((type) => ({ value: type, label: TYPE_LABEL[type] }))}
      />
      {optionType === 'choice' ? (
        <TextField
          control={editor.form.control}
          name="choicesText"
          label="Allowed values"
          placeholder="standard, premium"
          description="Comma-separated."
        />
      ) : null}
      {optionType === 'quantity' ? (
        <TextField control={editor.form.control} name="unit" label="Unit" placeholder="kW" />
      ) : null}
      <SwitchField
        control={editor.form.control}
        name="safetyRelevant"
        label="Safety-relevant"
        description="The answer pipeline treats its presence/absence as a hazard fact."
      />
      <TextareaField
        control={editor.form.control}
        name="description"
        label="Description"
        rows={2}
      />
    </EditorForm>
  );
}
