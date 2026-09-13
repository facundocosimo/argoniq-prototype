'use client';

import { useMemo, useState, type JSX } from 'react';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import {
  INSTALLATION_KINDS,
  type Installation,
  InstallationCreateInput,
  type InstallationKind,
} from '@argoniq/core-domain';
import { type SerialRow } from '@argoniq/db';
import {
  Button,
  ErrorState,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Inline,
  PageSection,
  Select,
  Stack,
  Text,
  useToast,
  useZodForm,
} from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { routes } from '../../lib/routes.js';
import { InlineDelete, ManageEditorShell, manageFailed, manageSaved } from './manage-kit.js';

const KIND_LABEL: Record<InstallationKind, string> = {
  line: 'Line',
  cell: 'Cell',
  skid: 'Skid',
  system: 'System',
};

/** Line editor page — create (`id === 'new'`) or edit one line + assign stations. */
export function LineEditor({ id }: { id: string }): JSX.Element {
  const isNew = id === 'new';
  const query = trpc.installation.get.useQuery({ installationId: id }, { enabled: !isNew });

  if (!isNew && query.isLoading) {
    return (
      <ManageEditorShell
        title="Line"
        entityLabel="Lines"
        listHref={routes.manage.lines}
        current="…"
      >
        <Text size="sm" tone="subtle">
          Loading…
        </Text>
      </ManageEditorShell>
    );
  }
  if (!isNew && (query.error || !query.data)) {
    return (
      <ManageEditorShell
        title="Line"
        entityLabel="Lines"
        listHref={routes.manage.lines}
        current="Not found"
      >
        <ErrorState
          title="Could not load line"
          description={query.error?.message ?? 'Please try again.'}
        />
      </ManageEditorShell>
    );
  }
  return <LineForm existing={isNew ? null : query.data!.installation} />;
}

function toDateInput(value: Date | undefined): string {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

function LineForm({ existing }: { existing: Installation | null }): JSX.Element {
  const router = useRouter();
  const toast = useToast();
  const utils = trpc.useUtils();
  const isNew = existing === null;
  const companies = trpc.management.listCompanies.useQuery({ limit: 100 });
  const refresh = (): void => void utils.installation.list.invalidate();

  const form = useZodForm(InstallationCreateInput, {
    values: {
      companyId: existing?.companyId ?? '',
      siteId: existing?.siteId ?? '',
      kind: existing?.kind ?? 'line',
      key: existing?.key ?? '',
      name: existing?.name ?? '',
      description: existing?.description ?? '',
      commissionedAt: toDateInput(existing?.commissionedAt),
      warrantyExpiresAt: toDateInput(existing?.warrantyExpiresAt),
      status: existing?.status ?? 'active',
    } as unknown as InstallationCreateInput,
  });
  const companyId = form.watch('companyId');
  const sites = trpc.management.listSites.useQuery(
    { limit: 100, companyId: (companyId || undefined) as never },
    { enabled: Boolean(companyId) },
  );

  const created = trpc.management.createInstallation.useMutation({
    onSuccess: (row) => {
      refresh();
      toast.success('Line created — now assign its stations');
      router.push(`${routes.manage.lines}/${row.id}`);
    },
    onError: manageFailed(toast, 'Could not save line'),
  });
  const updated = trpc.management.updateInstallation.useMutation({
    onSuccess: () => {
      refresh();
      manageSaved(toast, router, 'Line updated', routes.manage.lines)();
    },
    onError: manageFailed(toast, 'Could not save line'),
  });
  const removed = trpc.management.deleteInstallation.useMutation({
    onSuccess: () => {
      refresh();
      manageSaved(toast, router, 'Line deleted', routes.manage.lines)();
    },
    onError: manageFailed(toast, 'Could not delete line'),
  });
  const isPending = created.isPending || updated.isPending;

  const submit = form.handleSubmit((values) => {
    if (existing) {
      updated.mutate({
        id: existing.id,
        siteId: values.siteId,
        kind: values.kind,
        name: values.name,
        description: values.description,
        commissionedAt: values.commissionedAt,
        warrantyExpiresAt: values.warrantyExpiresAt,
        status: values.status,
      });
    } else {
      created.mutate(values);
    }
  });

  return (
    <ManageEditorShell
      title={isNew ? 'New line' : existing.name}
      entityLabel="Lines"
      listHref={routes.manage.lines}
      current={isNew ? 'New' : existing.name}
    >
      <Form {...form}>
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <PageSection
            title="Details"
            description="A line groups one company’s equipment at one site."
          >
            <Stack gap={4} className="max-w-2xl">
              <Inline gap={4} align="start" className="*:flex-1">
                <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Select
                          {...field}
                          disabled={!isNew}
                          onChange={(event) => {
                            field.onChange(event);
                            form.setValue('siteId', '');
                          }}
                        >
                          <option value="">Select…</option>
                          {(companies.data?.items ?? []).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="siteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site</FormLabel>
                      <FormControl>
                        <Select {...field} disabled={!companyId}>
                          <option value="">Select…</option>
                          {(sites.data?.items ?? []).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Inline>

              <Inline gap={4} align="start" className="*:flex-1">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Powder-coating line L1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key</FormLabel>
                      <FormControl>
                        <Input placeholder="finishing-line-l1" disabled={!isNew} {...field} />
                      </FormControl>
                      <FormDescription>lowercase-with-dashes</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Inline>

              <Inline gap={4} align="start" className="*:flex-1">
                <FormField
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <FormControl>
                        <Select {...field}>
                          {INSTALLATION_KINDS.map((kind) => (
                            <option key={kind} value={kind}>
                              {KIND_LABEL[kind]}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <Select {...field}>
                          <option value="not_installed">Not installed</option>
                          <option value="active">Active</option>
                          <option value="in_service">In service</option>
                          <option value="maintenance">Under maintenance</option>
                          <option value="decommissioned">Decommissioned</option>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Inline>

              <Inline gap={4} align="start" className="*:flex-1">
                <FormField
                  control={form.control}
                  name="commissionedAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commissioned</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={typeof field.value === 'string' ? field.value : ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="warrantyExpiresAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warranty until</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={typeof field.value === 'string' ? field.value : ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Inline>
            </Stack>
          </PageSection>
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isNew ? 'Create line' : 'Save changes'}
            </Button>
            <Button asChild type="button" variant="secondary">
              <Link href={routes.manage.lines}>Cancel</Link>
            </Button>
          </div>
        </form>
      </Form>

      {existing ? <StationsSection installation={existing} /> : null}

      {existing ? (
        <InlineDelete
          description="Lines with linked documents cannot be deleted. Otherwise, the line is removed and its stations become standalone machines. This cannot be undone."
          onConfirm={() => removed.mutate({ id: existing.id })}
          isPending={removed.isPending}
        />
      ) : null}
    </ManageEditorShell>
  );
}

/** Inline station assignment — tick the company's machines into this line, set flow order. */
function StationsSection({ installation }: { installation: Installation }): JSX.Element {
  const toast = useToast();
  const utils = trpc.useUtils();
  const serials = trpc.machine.listSerials.useQuery({
    limit: 100,
    companyId: installation.companyId,
  });
  const assignMut = trpc.management.assignSerial.useMutation();

  const candidates = useMemo(
    () =>
      (serials.data?.items ?? []).filter(
        (s) => !s.installationId || s.installationId === installation.id,
      ),
    [serials.data, installation.id],
  );

  const [draft, setDraft] = useState<Record<string, { assigned: boolean; position: string }>>({});
  const stateFor = (serial: SerialRow): { assigned: boolean; position: string } =>
    draft[serial.id] ?? {
      assigned: serial.installationId === installation.id,
      position: serial.position != null ? String(serial.position) : '',
    };

  const [saving, setSaving] = useState(false);
  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      for (const serial of candidates) {
        const next = stateFor(serial);
        const wasAssigned = serial.installationId === installation.id;
        const nextPosition = next.position === '' ? null : Number(next.position);
        const positionChanged = (serial.position ?? null) !== nextPosition;
        if (next.assigned === wasAssigned && !(next.assigned && positionChanged)) continue;
        await assignMut.mutateAsync({
          serialId: serial.id,
          installationId: next.assigned ? installation.id : null,
          position: next.assigned ? nextPosition : null,
          manufacturer: serial.manufacturer,
        });
      }
      toast.success('Stations updated');
      void utils.installation.get.invalidate({ installationId: installation.id });
      void utils.machine.listSerials.invalidate();
      void utils.installation.list.invalidate();
    } catch (error) {
      toast.danger('Could not update stations', { body: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageSection
      title="Stations"
      description="Tick the machines that belong to this line and set their flow position."
    >
      {serials.isLoading ? (
        <Text size="sm" tone="subtle">
          Loading machines…
        </Text>
      ) : candidates.length === 0 ? (
        <Text size="sm" tone="muted">
          This company has no unassigned machines to add.
        </Text>
      ) : (
        <Stack gap={3} className="max-w-2xl">
          <Stack gap={2}>
            {candidates.map((serial) => {
              const state = stateFor(serial);
              return (
                <div
                  key={serial.id}
                  className="border-border flex items-center gap-3 rounded-md border p-2"
                >
                  <input
                    type="checkbox"
                    className="accent-accent size-4"
                    checked={state.assigned}
                    aria-label={`Include ${serial.serialNumber}`}
                    onChange={(event) =>
                      setDraft((d) => ({
                        ...d,
                        [serial.id]: { ...state, assigned: event.target.checked },
                      }))
                    }
                  />
                  <span className="nums-tabular text-text flex-1 text-sm">
                    {serial.serialNumber}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={state.position}
                    disabled={!state.assigned}
                    aria-label={`Position of ${serial.serialNumber}`}
                    className="w-20"
                    placeholder="pos"
                    onChange={(event) =>
                      setDraft((d) => ({
                        ...d,
                        [serial.id]: { ...state, position: event.target.value },
                      }))
                    }
                  />
                </div>
              );
            })}
          </Stack>
          <Button type="button" className="w-fit" onClick={() => void save()} disabled={saving}>
            Save stations
          </Button>
        </Stack>
      )}
    </PageSection>
  );
}
