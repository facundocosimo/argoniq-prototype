'use client';

import { type JSX } from 'react';
import { z } from 'zod';
import { VARIANT_DATA_TYPES, VariantDataType } from '@argoniq/core-domain';
import { type VariantAxisRow } from '@argoniq/db';
import { ComboboxField, ErrorState, SwitchField, TextField } from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { routes } from '../../lib/routes.js';
import { ManageEditorShell } from './manage-kit.js';
import { EditorForm, EntityLoader, useEntityEditor, useManageHandlers } from './editor-kit.js';

const TYPE_LABEL: Record<VariantDataType, string> = {
  enum: 'Choice (enum)',
  number: 'Number',
  boolean: 'Yes / no',
  string: 'Text',
};

/**
 * Form schema (UI-level): `options` is entered comma-separated and split on submit.
 * Client-validates the same "an enum axis needs values" rule the server enforces.
 */
const AxisFormSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .max(63)
      .regex(/^[a-z0-9_]+$/, 'lowercase_with_underscores'),
    label: z.string().min(1).max(200),
    dataType: VariantDataType,
    optionsText: z.string().max(500),
    unit: z.string().max(32),
    safetyRelevant: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.dataType === 'enum' && splitValues(value.optionsText).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['optionsText'],
        message: 'Add at least one allowed value.',
      });
    }
  });

function splitValues(text: string): string[] {
  return text
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Variant-axis editor — create (`id === 'new'`, model from `?modelId=`) or edit. */
export function AxisEditor({
  id,
  modelId,
}: {
  id: string;
  modelId?: string | undefined;
}): JSX.Element {
  const isNew = id === 'new';
  const query = trpc.management.getVariantAxis.useQuery({ axisId: id }, { enabled: !isNew });

  if (isNew && !modelId) {
    return (
      <ManageEditorShell
        title="New axis"
        entityLabel="Models"
        listHref={routes.manage.models}
        current="New"
      >
        <ErrorState
          title="No model selected"
          description="Open a model in the catalog and add the axis from there."
        />
      </ManageEditorShell>
    );
  }

  return (
    <EntityLoader
      id={id}
      query={query}
      entity="Axis"
      entityLabel="Models"
      listHref={routes.manage.models}
    >
      {(existing) => (
        <AxisForm existing={existing} modelId={existing ? existing.modelId : modelId!} />
      )}
    </EntityLoader>
  );
}

function AxisForm({
  existing,
  modelId,
}: {
  existing: VariantAxisRow | null;
  modelId: string;
}): JSX.Element {
  const listHref = routes.manage.modelsModel(modelId);
  const handlers = useManageHandlers({
    entity: 'Axis',
    listHref,
    invalidate: (u) => u.management.listVariantAxes.invalidate({ modelId }),
  });
  const create = trpc.management.createVariantAxis.useMutation(handlers.saved('Axis added'));
  const update = trpc.management.updateVariantAxis.useMutation(handlers.saved('Axis updated'));
  const remove = trpc.management.deleteVariantAxis.useMutation(handlers.deleted('Axis removed'));

  const editor = useEntityEditor({
    existing,
    schema: AxisFormSchema,
    defaults: {
      key: '',
      label: '',
      dataType: 'enum',
      optionsText: '',
      unit: '',
      safetyRelevant: false,
    },
    fromRow: (row) => ({
      key: row.key,
      label: row.label,
      dataType: row.dataType,
      optionsText: (row.options ?? []).join(', '),
      unit: row.unit ?? '',
      safetyRelevant: row.safetyRelevant,
    }),
    create,
    update,
    remove,
    toCreate: (v) => ({
      modelId,
      key: v.key,
      label: v.label,
      dataType: v.dataType,
      options: v.dataType === 'enum' ? splitValues(v.optionsText) : undefined,
      unit: v.dataType === 'number' ? v.unit : undefined,
      safetyRelevant: v.safetyRelevant,
    }),
    toUpdate: (row, v) => ({
      id: row.id,
      label: v.label,
      dataType: v.dataType,
      options: v.dataType === 'enum' ? splitValues(v.optionsText) : undefined,
      unit: v.dataType === 'number' ? v.unit : undefined,
      safetyRelevant: v.safetyRelevant,
    }),
    deleteInput: (row) => ({ id: row.id }),
  });

  const dataType = editor.form.watch('dataType');

  return (
    <EditorForm
      editor={editor}
      title={existing ? existing.label : 'New axis'}
      entityLabel="Models"
      listHref={listHref}
      createLabel="Add axis"
      sectionDescription="A dimension along which this model's units differ. A serial resolves one value per axis."
      deleteDescription="Machines’ stored values for this axis are ignored afterwards. This cannot be undone."
    >
      <TextField
        control={editor.form.control}
        name="label"
        label="Label"
        placeholder="Build material"
      />
      <TextField
        control={editor.form.control}
        name="key"
        label="Key"
        placeholder="material"
        disabled={!editor.isNew}
        description={
          editor.isNew ? 'lowercase_with_underscores' : 'lowercase_with_underscores · fixed'
        }
      />
      <ComboboxField
        control={editor.form.control}
        name="dataType"
        label="Type"
        searchable={false}
        options={VARIANT_DATA_TYPES.map((type) => ({ value: type, label: TYPE_LABEL[type] }))}
      />
      {dataType === 'enum' ? (
        <TextField
          control={editor.form.control}
          name="optionsText"
          label="Allowed values"
          placeholder="LAB-A, LAB-B"
          description="Comma-separated."
        />
      ) : null}
      {dataType === 'number' ? (
        <TextField control={editor.form.control} name="unit" label="Unit" placeholder="lasers" />
      ) : null}
      <SwitchField
        control={editor.form.control}
        name="safetyRelevant"
        label="Safety-relevant"
        description="The answer pipeline treats this axis's value as a hazard fact that can gate answer modes."
      />
    </EditorForm>
  );
}
