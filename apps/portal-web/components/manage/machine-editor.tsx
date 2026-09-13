'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import { type Control, type FieldPath } from 'react-hook-form';
import { ShieldAlert } from 'lucide-react';
import { type z } from 'zod';
import {
  SERIAL_STATUSES,
  SerialCreateInput,
  type ResolvedOption,
  type SerialStatus,
  type VariantOptionValue,
} from '@argoniq/core-domain';
import { type SerialRow, type VariantAxisRow } from '@argoniq/db';
import {
  Button,
  Combobox,
  ComboboxField,
  type ComboboxOption,
  FieldGrid,
  Input,
  Inline,
  PageSection,
  Stack,
  Text,
  TextField,
  useToast,
} from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { routes } from '../../lib/routes.js';
import { countryName, flagEmoji } from '../../lib/countries.js';
import { ManageEditorShell, manageFailed } from './manage-kit.js';
import { EditorForm, EntityLoader, useEntityEditor, useManageHandlers } from './editor-kit.js';

type SerialFormInput = z.input<typeof SerialCreateInput>;

const STATUS_LABEL: Record<SerialStatus, string> = {
  not_installed: 'Not installed',
  active: 'Active',
  in_service: 'In service',
  maintenance: 'Under maintenance',
  decommissioned: 'Decommissioned',
};

/** Coerce string-valued option inputs into the typed values the model's axes expect. */
function coerceOptionValues(
  axes: readonly VariantAxisRow[],
  raw: Record<string, VariantOptionValue>,
): Record<string, VariantOptionValue> {
  const out: Record<string, VariantOptionValue> = {};
  for (const axis of axes) {
    const value = raw[axis.key];
    if (value === undefined || value === '') continue;
    if (axis.dataType === 'number') {
      const n = Number(value);
      if (!Number.isNaN(n)) out[axis.key] = n;
    } else if (axis.dataType === 'boolean') {
      out[axis.key] = value === 'true' || value === true;
    } else {
      out[axis.key] = String(value);
    }
  }
  return out;
}

/** Machine editor page — create (`id === 'new'`) or edit one installed serial. `companyId`
 *  pre-selects the owning company when creating from that company's account hub. */
export function MachineEditor({
  id,
  companyId,
}: {
  id: string;
  companyId?: string | undefined;
}): JSX.Element {
  const query = trpc.machine.getSerial.useQuery({ serialId: id }, { enabled: id !== 'new' });
  return (
    <EntityLoader
      id={id}
      query={query}
      entity="Machine"
      entityLabel="Machines"
      listHref={routes.machines}
    >
      {(existing) => <MachineForm existing={existing} defaultCompanyId={companyId} />}
    </EntityLoader>
  );
}

function MachineForm({
  existing,
  defaultCompanyId,
}: {
  existing: SerialRow | null;
  defaultCompanyId?: string | undefined;
}): JSX.Element {
  const handlers = useManageHandlers({
    entity: 'Machine',
    listHref: routes.machines,
    invalidate: (u) => u.machine.listSerials.invalidate(),
  });
  const create = trpc.management.createSerial.useMutation(handlers.saved('Machine registered'));
  const update = trpc.management.updateSerial.useMutation(handlers.saved('Machine updated'));
  const remove = trpc.management.deleteSerial.useMutation(handlers.deleted('Machine deleted'));

  // The model's variant axes drive option-value coercion at submit. The query depends
  // on the watched modelId (so it lives below the editor); a ref carries the latest set
  // into the toCreate/toUpdate closures, read only at submit time.
  const axesRef = useRef<readonly VariantAxisRow[]>([]);

  const editor = useEntityEditor({
    existing,
    schema: SerialCreateInput,
    defaults: {
      companyId: defaultCompanyId ?? '',
      siteId: '',
      familyId: '',
      modelId: '',
      serialNumber: '',
      firmwareVersion: '',
      status: 'active',
      optionValues: {},
    },
    fromRow: (row) => ({
      companyId: row.companyId,
      siteId: row.siteId,
      familyId: row.familyId,
      modelId: row.modelId,
      serialNumber: row.serialNumber,
      firmwareVersion: row.firmwareVersion ?? '',
      status: row.status,
      optionValues: Object.fromEntries(
        Object.entries(row.optionValues ?? {}).map(([key, value]) => [key, String(value)]),
      ),
    }),
    create,
    update,
    remove,
    toCreate: (v) => ({
      ...v,
      optionValues: coerceOptionValues(axesRef.current, v.optionValues ?? {}),
    }),
    toUpdate: (row, v) => ({
      id: row.id,
      siteId: v.siteId,
      serialNumber: v.serialNumber,
      firmwareVersion: v.firmwareVersion,
      status: v.status,
      optionValues: coerceOptionValues(axesRef.current, v.optionValues ?? {}),
    }),
    deleteInput: (row) => ({ id: row.id }),
  });

  const router = useRouter();

  const { control } = editor.form;
  const companyId = editor.form.watch('companyId');
  const familyId = editor.form.watch('familyId');
  const modelId = editor.form.watch('modelId');

  const companies = trpc.management.listCompanies.useQuery({ limit: 100 });
  const sites = trpc.management.listSites.useQuery(
    { limit: 100, companyId: companyId || undefined },
    { enabled: Boolean(companyId) },
  );
  const families = trpc.management.listFamilies.useQuery();
  const models = trpc.management.listModels.useQuery({ familyId }, { enabled: Boolean(familyId) });
  const axes = trpc.management.listVariantAxes.useQuery({ modelId }, { enabled: Boolean(modelId) });
  const currentAxes = axes.data ?? [];
  axesRef.current = currentAxes;

  const companyOptions: ComboboxOption[] = (companies.data?.items ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const siteOptions: ComboboxOption[] = (sites.data?.items ?? []).map((s) => ({
    value: s.id,
    label: s.name,
    description: countryName(s.countryCode) || undefined,
    leading: flagEmoji(s.countryCode) || undefined,
    keywords: s.countryCode ? [s.countryCode] : undefined,
  }));
  const familyOptions: ComboboxOption[] = (families.data ?? []).map((f) => ({
    value: f.id,
    label: f.name,
    description: f.key,
  }));
  const modelOptions: ComboboxOption[] = (models.data ?? []).map((m) => ({
    value: m.id,
    label: m.name,
    description: m.key,
  }));

  // A machine is built from a model, so the one hard prerequisite is a catalog. Companies
  // and sites can be created right from their pickers, so only an empty catalog blocks the
  // form — guide the user to Catalog Studio rather than dead-ending on an empty Family list.
  const noFamilies = editor.isNew && !families.isLoading && (families.data?.length ?? 0) === 0;
  if (noFamilies) {
    return (
      <ManageEditorShell
        title="New machine"
        entityLabel="Machines"
        listHref={routes.machines}
        current="New"
      >
        <MachinePrerequisites />
      </ManageEditorShell>
    );
  }

  return (
    <EditorForm
      editor={editor}
      layout="plain"
      title={existing ? existing.serialNumber : 'New machine'}
      entityLabel="Machines"
      listHref={routes.machines}
      createLabel="Register machine"
      deleteDescription="A machine with support history cannot be deleted. This cannot be undone."
      belowForm={existing ? <SerialOptionsSection serial={existing} /> : undefined}
    >
      {/* Who owns it, and where it runs. Company is fixed once set; the site can move. */}
      <PageSection
        title="Assignment"
        description={
          existing
            ? 'The company is fixed; a machine can be relocated between that company’s sites.'
            : 'Who you sold it to and where it’s installed.'
        }
      >
        <FieldGrid>
          <ComboboxField
            control={control}
            name="companyId"
            label="Company"
            placeholder="Select a company…"
            searchPlaceholder="Search companies…"
            options={companyOptions}
            loading={companies.isLoading}
            disabled={!editor.isNew}
            onCreate={
              editor.isNew
                ? (name) =>
                    router.push(
                      `${routes.manage.companies}/new${name ? `?name=${encodeURIComponent(name)}` : ''}`,
                    )
                : undefined
            }
            createLabel={(q) => (q ? `Create company “${q}”` : 'Create new company')}
            onValueChange={() => editor.form.setValue('siteId', '', { shouldDirty: true })}
          />
          <ComboboxField
            control={control}
            name="siteId"
            label="Site"
            placeholder={companyId ? 'Select a site…' : 'Pick a company first'}
            searchPlaceholder="Search sites…"
            options={siteOptions}
            loading={Boolean(companyId) && sites.isLoading}
            disabled={editor.isNew && !companyId}
            onCreate={
              editor.isNew && companyId
                ? (name) =>
                    router.push(
                      `${routes.manage.sites}/new?companyId=${companyId}${name ? `&name=${encodeURIComponent(name)}` : ''}`,
                    )
                : undefined
            }
            createLabel={(q) => (q ? `Create site “${q}”` : 'Create new site')}
          />
        </FieldGrid>
      </PageSection>

      {/* What it is — family then model; both fixed after creation (a re-model is a new record). */}
      <PageSection
        title="Equipment"
        description={existing ? 'Family and model are fixed for this machine.' : undefined}
      >
        <FieldGrid>
          <ComboboxField
            control={control}
            name="familyId"
            label="Family"
            placeholder="Select a family…"
            searchPlaceholder="Search families…"
            options={familyOptions}
            loading={families.isLoading}
            disabled={!editor.isNew}
            onCreate={
              editor.isNew
                ? (name) =>
                    router.push(
                      `${routes.manage.modelsFamily('new')}${name ? `?name=${encodeURIComponent(name)}` : ''}`,
                    )
                : undefined
            }
            createLabel={(q) => (q ? `Create family “${q}”` : 'Create new family')}
            onValueChange={() => {
              editor.form.setValue('modelId', '', { shouldDirty: true });
              editor.form.setValue('optionValues', {}, { shouldDirty: true });
            }}
          />
          <ComboboxField
            control={control}
            name="modelId"
            label="Model"
            placeholder={familyId ? 'Select a model…' : 'Pick a family first'}
            searchPlaceholder="Search models…"
            options={modelOptions}
            loading={Boolean(familyId) && models.isLoading}
            disabled={!editor.isNew || !familyId}
            onCreate={
              editor.isNew && familyId
                ? (name) =>
                    router.push(
                      `${routes.manage.modelsModel('new')}?familyId=${familyId}${name ? `&name=${encodeURIComponent(name)}` : ''}`,
                    )
                : undefined
            }
            createLabel={(q) => (q ? `Create model “${q}”` : 'Create new model')}
            onValueChange={() => editor.form.setValue('optionValues', {}, { shouldDirty: true })}
          />
        </FieldGrid>
      </PageSection>

      {/* This unit — serial is the widest, firmware and status are compact. */}
      <PageSection title="Identity">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <TextField
            control={control}
            name="serialNumber"
            label="Serial number"
            placeholder="ATLAS-DEMO-001"
            className="sm:col-span-2"
          />
          <TextField
            control={control}
            name="firmwareVersion"
            label="Firmware"
            placeholder="3.2.1"
            description="Optional"
            className="sm:col-span-1"
          />
          <ComboboxField
            control={control}
            name="status"
            label="Status"
            searchable={false}
            options={SERIAL_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            className="sm:col-span-1"
          />
        </div>
      </PageSection>

      {/* As-built configuration — the model's variant axes. */}
      <PageSection title="Configuration" description="How this specific unit is configured.">
        {modelId ? (
          <OptionAxesFields control={control} axes={currentAxes} isLoading={axes.isLoading} />
        ) : (
          <Text size="sm" tone="subtle">
            Select a model to configure its variant options.
          </Text>
        )}
      </PageSection>
    </EditorForm>
  );
}

/**
 * Create-time prerequisite guide — shown instead of an empty Family list when the catalog
 * has no models yet. A machine can't exist without a model to build from, so we route the
 * user to Catalog Studio rather than dead-ending. Companies and sites are created from
 * their own pickers, so they never gate this form.
 */
function MachinePrerequisites(): JSX.Element {
  return (
    <Stack gap={4} className="max-w-xl">
      <Text tone="muted">
        A machine is built from a model, so your machine catalog needs at least one family and model
        before you can register one. Set that up first, then come back.
      </Text>
      <Button asChild size="sm" className="w-fit">
        <Link href={routes.manage.models}>Set up the catalog</Link>
      </Button>
    </Stack>
  );
}

/** As-built variant-axis editor — a responsive grid of one combobox/field per axis. */
function OptionAxesFields({
  control,
  axes,
  isLoading,
}: {
  control: Control<SerialFormInput>;
  axes: readonly VariantAxisRow[];
  isLoading: boolean;
}): JSX.Element {
  if (isLoading)
    return (
      <Text size="sm" tone="subtle">
        Loading configuration…
      </Text>
    );
  if (axes.length === 0)
    return (
      <Text size="sm" tone="subtle">
        This model has no configurable variant axes.
      </Text>
    );
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {axes.map((axis) => {
        const name = `optionValues.${axis.key}` as FieldPath<SerialFormInput>;
        const label = axis.unit ? `${axis.label} (${axis.unit})` : axis.label;
        if (axis.dataType === 'enum') {
          return (
            <ComboboxField<SerialFormInput>
              key={axis.id}
              control={control}
              name={name}
              label={label}
              placeholder="Not set"
              searchPlaceholder="Search values…"
              options={[
                { value: '', label: 'Not set' },
                ...(axis.options ?? []).map((o) => ({ value: o, label: o })),
              ]}
            />
          );
        }
        if (axis.dataType === 'boolean') {
          return (
            <ComboboxField<SerialFormInput>
              key={axis.id}
              control={control}
              name={name}
              label={label}
              searchable={false}
              placeholder="Not set"
              options={[
                { value: '', label: 'Not set' },
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
              ]}
            />
          );
        }
        return (
          <TextField<SerialFormInput>
            key={axis.id}
            control={control}
            name={name}
            label={label}
            type={axis.dataType === 'number' ? 'number' : 'text'}
          />
        );
      })}
    </div>
  );
}

type Draft = Record<string, { present: boolean; chosenValue: string }>;

/** Inline per-serial option selection — the installable modules fitted to this machine. */
function SerialOptionsSection({ serial }: { serial: SerialRow }): JSX.Element {
  const toast = useToast();
  const utils = trpc.useUtils();
  const options = trpc.machine.resolveOptions.useQuery({ serialId: serial.id });
  const setMut = trpc.management.setSerialOptions.useMutation({
    onSuccess: () => {
      toast.success('Options saved');
      void utils.machine.resolveOptions.invalidate({ serialId: serial.id });
    },
    onError: manageFailed(toast, 'Could not save options'),
  });

  const [draft, setDraft] = useState<Draft>({});
  useEffect(() => {
    if (!options.data) return;
    const initial: Draft = {};
    for (const option of options.data)
      initial[option.optionDefId] = {
        present: option.present,
        chosenValue: option.chosenValue ?? '',
      };
    setDraft(initial);
  }, [options.data]);

  const rows: readonly ResolvedOption[] = options.data ?? [];
  const stateFor = (optionDefId: string): { present: boolean; chosenValue: string } =>
    draft[optionDefId] ?? { present: false, chosenValue: '' };

  const save = (): void => {
    setMut.mutate({
      serialId: serial.id,
      selections: rows.map((option) => {
        const state = stateFor(option.optionDefId);
        return {
          optionDefId: option.optionDefId,
          present: state.present,
          chosenValue: state.present ? state.chosenValue : undefined,
        };
      }),
    });
  };

  return (
    <PageSection
      title="Fitted options"
      description="Installable modules fitted to this machine (validated against the model’s rules)."
    >
      {options.isLoading ? (
        <Text size="sm" tone="subtle">
          Loading options…
        </Text>
      ) : rows.length === 0 ? (
        <Text size="sm" tone="muted">
          This model has no option catalog yet.{' '}
          <Link
            href={routes.manage.modelsModel(serial.modelId)}
            className="text-accent ease-out-fast focus-visible:outline-focus underline-offset-4 transition-colors duration-150 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Add options to the model
          </Link>
          .
        </Text>
      ) : (
        <Stack gap={3}>
          <Stack gap={2}>
            {rows.map((option) => {
              const state = stateFor(option.optionDefId);
              return (
                <div
                  key={option.optionDefId}
                  className="border-border flex items-center gap-3 rounded-md border p-2"
                >
                  <input
                    type="checkbox"
                    className="accent-accent size-4"
                    checked={state.present}
                    aria-label={`Fit ${option.label}`}
                    onChange={(event) =>
                      setDraft((d) => ({
                        ...d,
                        [option.optionDefId]: { ...state, present: event.target.checked },
                      }))
                    }
                  />
                  <span className="text-text flex flex-1 items-center gap-2 text-sm">
                    {option.label}
                    {option.safetyRelevant ? (
                      <ShieldAlert
                        className="text-zone-red size-3.5"
                        aria-label="safety-relevant"
                      />
                    ) : null}
                  </span>
                  {option.optionType === 'choice' ? (
                    <Combobox
                      className="w-40"
                      value={state.chosenValue}
                      disabled={!state.present}
                      searchable={false}
                      placeholder="Select…"
                      aria-label={`${option.label} value`}
                      options={(option.choices ?? []).map((choice) => ({
                        value: choice,
                        label: choice,
                      }))}
                      onChange={(value) =>
                        setDraft((d) => ({
                          ...d,
                          [option.optionDefId]: { ...state, chosenValue: value },
                        }))
                      }
                    />
                  ) : option.optionType === 'quantity' ? (
                    <Inline gap={1} align="center">
                      <Input
                        type="number"
                        className="w-24"
                        value={state.chosenValue}
                        disabled={!state.present}
                        aria-label={`${option.label} value`}
                        onChange={(event) =>
                          setDraft((d) => ({
                            ...d,
                            [option.optionDefId]: { ...state, chosenValue: event.target.value },
                          }))
                        }
                      />
                      {option.unit ? (
                        <Text size="xs" tone="subtle">
                          {option.unit}
                        </Text>
                      ) : null}
                    </Inline>
                  ) : null}
                </div>
              );
            })}
          </Stack>
          <Button type="button" className="w-fit" onClick={save} disabled={setMut.isPending}>
            Save options
          </Button>
        </Stack>
      )}
    </PageSection>
  );
}
