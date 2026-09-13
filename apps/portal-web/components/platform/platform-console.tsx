'use client';

import { useState, type JSX } from 'react';
import { LogIn, Network, Plus } from 'lucide-react';
import { TenantCreateInput } from '@argoniq/core-domain';
import { type TenantRow } from '@argoniq/db';
import {
  Button,
  type ColumnDef,
  DataTable,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Inline,
  Input,
  Stack,
  useToast,
  useZodForm,
} from '@argoniq/ui';
import { PageChrome } from '../../lib/page-chrome.js';
import { trpc } from '../../lib/trpc/client.js';
import { impersonateTenant } from '../../lib/demo/switch.js';

/**
 * Platform console — the super-admin's Manufacturer registry. Onboard a new OEM, and
 * "Enter" any OEM to work inside its portal as an admin (impersonation). Reads/writes
 * go through the `platformProcedure` surface (the only cross-tenant path); entering a
 * tenant is a session change handled by the dev session route, audited server-side.
 */
export function PlatformConsole(): JSX.Element {
  const list = trpc.platform.listTenants.useQuery();
  const [creating, setCreating] = useState(false);

  const columns: ColumnDef<TenantRow>[] = [
    {
      accessorKey: 'name',
      header: 'OEM',
      cell: ({ row }) => (
        <span className="text-text flex items-center gap-2 font-medium">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: row.original.brandAccentColor ?? 'var(--color-accent)' }}
            aria-hidden
          />
          {row.original.name}
        </span>
      ),
    },
    {
      accessorKey: 'slug',
      header: 'Slug',
      cell: ({ row }) => (
        <code className="bg-surface text-text-muted rounded px-1.5 py-0.5 text-xs">
          {row.original.slug}
        </code>
      ),
    },
    {
      accessorKey: 'region',
      header: 'Region',
      cell: ({ row }) => (
        <span className="nums-tabular text-text-muted">{row.original.region}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <Inline justify="end">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void impersonateTenant(row.original.id, row.original.name)}
          >
            <LogIn className="size-4" aria-hidden />
            Enter
          </Button>
        </Inline>
      ),
    },
  ];

  return (
    <>
      <PageChrome
        title="Manufacturers"
        breadcrumbs={[{ label: 'Platform' }, { label: 'Manufacturers' }]}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden />
            Onboard OEM
          </Button>
        }
      />
      <Stack gap={4}>
        <DataTable
          columns={columns}
          data={list.data ?? []}
          getRowId={(row) => row.id}
          caption="Manufacturers"
          isLoading={list.isLoading}
          error={
            list.error ? (
              <ErrorState title="Could not load tenants" description={list.error.message} />
            ) : undefined
          }
          empty={
            <EmptyState
              icon={<Network className="size-6" aria-hidden />}
              title="No OEMs yet"
              description="Onboard the first machine-builder to create their isolated tenant."
              action={
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden />
                  Onboard OEM
                </Button>
              }
            />
          }
        />
      </Stack>

      <OnboardOemDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function OnboardOemDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const toast = useToast();
  const utils = trpc.useUtils();
  const form = useZodForm(TenantCreateInput, {
    values: { name: '', slug: '', region: 'eu-central-1', brandAccentColor: '' },
  });

  const createMut = trpc.platform.createTenant.useMutation({
    onSuccess: (row) => {
      void utils.platform.listTenants.invalidate();
      toast.success(`${row.name} onboarded`);
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => toast.danger('Could not onboard OEM', { body: error.message }),
  });

  const submit = form.handleSubmit((values) => createMut.mutate(values));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="center" className="w-modal">
        <DialogHeader>
          <DialogTitle>Onboard OEM</DialogTitle>
          <DialogDescription>
            Register a new machine-builder as an isolated tenant.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(event) => void submit(event)}>
            <DialogBody>
              <Stack gap={4}>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company name</FormLabel>
                      <FormControl>
                        <Input placeholder="Helios Robotics" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <Input placeholder="helios-robotics" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Inline gap={4} align="start" className="*:flex-1">
                  <FormField
                    control={form.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Region</FormLabel>
                        <FormControl>
                          <Input placeholder="eu-central-1" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormDescription>Data residency</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="brandAccentColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brand color</FormLabel>
                        <FormControl>
                          <Input placeholder="#1559d6" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormDescription>Optional hex</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Inline>
              </Stack>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={createMut.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                Onboard OEM
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
