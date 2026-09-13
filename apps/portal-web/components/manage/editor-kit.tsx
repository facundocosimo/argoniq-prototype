'use client';

import { useEffect, useRef, type FormEvent, type JSX, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import { type FieldValues, type UseFormReturn } from 'react-hook-form';
import { type z } from 'zod';
import {
  Button,
  ErrorState,
  Form,
  PageSection,
  Skeleton,
  Stack,
  useToast,
  useZodForm,
} from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { useWorkspaceAbility, useWorkspaceScope } from '../../lib/workspace-access.js';
import {
  InlineDelete,
  ManageEditorShell,
  manageFailed,
  manageSaved,
  managementSubject,
} from './manage-kit.js';

/**
 * Editor kit — the DRY spine for every add/edit page. Three
 * pieces remove the ~80 lines of boilerplate each CRUD editor used to repeat:
 *   • useManageHandlers — the shared create/update/delete result handling (invalidate
 *     the list, success toast, navigate back; a plain-language failure toast).
 *   • useEntityEditor    — builds the schema-bound form (validate-on-blur), derives
 *     new/dirty/pending, and wires a ready `onSubmit` + delete. Save is gated on a
 *     real change, so a no-op never submits.
 *   • EntityLoader / EditorForm — the load (loading/error/not-found) states and the
 *     two-column layout (form + metadata rail), action bar, and danger zone.
 * One zod schema drives client validation AND the server `parseInput`, so they can
 * never drift.
 */

type Utils = ReturnType<typeof trpc.useUtils>;

/** Standard mutation-result options: invalidate + success toast + navigate; failure toast. */
export function useManageHandlers(config: {
  /** Singular entity noun for messages, e.g. "Company". */
  entity: string;
  /** Where to return after a successful save/delete. */
  listHref: string;
  /** Invalidate the affected list query (and any dependents). */
  invalidate: (utils: Utils) => unknown;
}): {
  saved: (message: string) => {
    onSuccess: () => void;
    onError: (error: { message: string }) => void;
  };
  deleted: (message: string) => {
    onSuccess: () => void;
    onError: (error: { message: string }) => void;
  };
} {
  const router = useRouter();
  const toast = useToast();
  const utils = trpc.useUtils();
  const noun = config.entity.toLowerCase();
  const scope = useWorkspaceScope();
  const on = (message: string, verb: 'save' | 'delete') => ({
    onSuccess: () => {
      try {
        sessionStorage.removeItem(`argoniq:editor:${scope}:${window.location.pathname}`);
      } catch {
        /* Optional draft. */
      }
      void config.invalidate(utils);
      manageSaved(toast, router, message, config.listHref)();
    },
    onError: manageFailed(toast, `Could not ${verb} ${noun}`),
  });
  return { saved: (m) => on(m, 'save'), deleted: (m) => on(m, 'delete') };
}

type MutationLike<TInput> = { mutate: (input: TInput) => void; isPending: boolean };
type SchemaInput<TSchema extends z.ZodTypeAny> =
  z.input<TSchema> extends FieldValues ? z.input<TSchema> : never;
type SchemaOutput<TSchema extends z.ZodTypeAny> =
  z.output<TSchema> extends FieldValues ? z.output<TSchema> : never;

export type EntityEditor<TInput extends FieldValues, TOutput extends FieldValues = TInput> = {
  form: UseFormReturn<TInput, unknown, TOutput>;
  isNew: boolean;
  isPending: boolean;
  /** Dirty-and-not-pending (or a fresh create) — drives the Save button. */
  canSave: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  remove: { onConfirm: () => void; isPending: boolean };
};

/**
 * Build the CRUD form for one entity. The caller creates the tRPC mutations
 * (top-level, wired with `useManageHandlers`) and passes them in, plus the mapping
 * from form values to the create/update/delete inputs — so the whole submit
 * lifecycle collapses to config.
 */
export function useEntityEditor<
  TSchema extends z.ZodTypeAny,
  TRow,
  TCreate,
  TUpdate,
  TDelete,
>(config: {
  existing: TRow | null;
  schema: TSchema;
  /** Form values for a fresh record. */
  defaults: SchemaInput<TSchema>;
  /** Populate the form from an existing row (edit). */
  fromRow: (row: TRow) => SchemaInput<TSchema>;
  create: MutationLike<TCreate>;
  update: MutationLike<TUpdate>;
  remove: MutationLike<TDelete>;
  toCreate: (values: SchemaOutput<TSchema>) => TCreate;
  toUpdate: (existing: TRow, values: SchemaOutput<TSchema>) => TUpdate;
  deleteInput: (existing: TRow) => TDelete;
}): EntityEditor<SchemaInput<TSchema>, SchemaOutput<TSchema>> {
  const { existing } = config;
  const isNew = existing === null;
  const scope = useWorkspaceScope();

  const form = useZodForm(config.schema, {
    // Validate as each field is left (best practice), not only on submit.
    mode: 'onTouched',
    values: isNew ? config.defaults : config.fromRow(existing),
  });
  useEffect(() => {
    const key = `argoniq:editor:${scope}:${window.location.pathname}`;
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        const current = form.getValues();
        const draft = Object.fromEntries(
          Object.keys(current)
            .filter((field) => field in saved)
            .map((field) => [field, (saved as Record<string, unknown>)[field]]),
        );
        form.reset({ ...current, ...draft });
      }
    } catch {
      /* The form remains usable without draft storage. */
    }
    const subscription = form.watch((values) => {
      try {
        sessionStorage.setItem(key, JSON.stringify(values));
      } catch {
        /* Optional. */
      }
    });
    return () => subscription.unsubscribe();
  }, [form, scope]);

  const isPending = config.create.isPending || config.update.isPending;
  const canSave = !isPending && (isNew || form.formState.isDirty);

  const submit = form.handleSubmit((values) => {
    if (existing) config.update.mutate(config.toUpdate(existing, values));
    else config.create.mutate(config.toCreate(values));
  });

  return {
    form,
    isNew,
    isPending,
    canSave,
    onSubmit: (event) => void submit(event),
    remove: {
      onConfirm: () => existing && config.remove.mutate(config.deleteInput(existing)),
      isPending: config.remove.isPending,
    },
  };
}

/**
 * Loader for an edit page — resolves the create-vs-edit path and renders the shared
 * loading / error / not-found states, then hands the row (or `null` for create) to
 * the form via a render prop. `id === 'new'` is create.
 */
export function EntityLoader<TData>({
  id,
  query,
  entity,
  entityLabel,
  listHref,
  children,
}: {
  id: string;
  query: { isLoading: boolean; error: { message: string } | null; data: TData | undefined };
  entity: string;
  entityLabel: string;
  listHref: string;
  children: (existing: TData | null) => ReactNode;
}): JSX.Element {
  if (id === 'new') return <>{children(null)}</>;
  if (query.isLoading) {
    return (
      <ManageEditorShell title={entity} entityLabel={entityLabel} listHref={listHref} current="…">
        <Stack gap={6}>
          {[0, 1, 2].map((i) => (
            <Stack key={i} gap={2}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </Stack>
          ))}
        </Stack>
      </ManageEditorShell>
    );
  }
  if (query.error || !query.data) {
    return (
      <ManageEditorShell
        title={entity}
        entityLabel={entityLabel}
        listHref={listHref}
        current="Not found"
      >
        <ErrorState
          title={`Could not load ${entity.toLowerCase()}`}
          description={query.error?.message ?? 'Please try again.'}
        />
      </ManageEditorShell>
    );
  }
  return <>{children(query.data)}</>;
}

/**
 * The standard add/edit layout: the shell chrome, a two-column body (the form on the
 * left, an optional metadata rail on the right that stacks below on mobile), the
 * action bar, and the danger zone for existing records. The first field is focused on
 * mount for keyboard users.
 */
export function EditorForm<TInput extends FieldValues, TOutput extends FieldValues>({
  editor,
  title,
  entityLabel,
  listHref,
  current,
  layout = 'section',
  sectionTitle = 'Details',
  sectionDescription,
  createLabel = 'Create',
  updateLabel = 'Save changes',
  belowForm,
  deleteDescription,
  children,
}: {
  editor: EntityEditor<TInput, TOutput>;
  title: string;
  entityLabel: string;
  listHref: string;
  current?: string;
  /** 'section' wraps children in the standard "Details" card; 'plain' lets the
   *  caller supply its own PageSections + grid (for smart per-field layouts). */
  layout?: 'section' | 'plain';
  sectionTitle?: string;
  sectionDescription?: string;
  createLabel?: string;
  updateLabel?: string;
  /** Full-width content below the form, above the danger zone (e.g. a related-items hub). */
  belowForm?: ReactNode;
  /** Enables the danger zone with this copy (existing records only). */
  deleteDescription?: string;
  children: ReactNode;
}): JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const ability = useWorkspaceAbility();
  const subject = managementSubject(listHref);
  const canWrite = Boolean(ability?.can(editor.isNew ? 'create' : 'update', subject));
  // Autofocus the first field (a11y-lint-safe — no autoFocus prop).
  useEffect(() => {
    if (!editor.isNew || !canWrite) return;
    formRef.current
      ?.querySelector<HTMLElement>('input, select, textarea, [role="switch"]')
      ?.focus();
  }, [editor.isNew, canWrite]);

  return (
    <ManageEditorShell
      title={title}
      entityLabel={entityLabel}
      listHref={listHref}
      current={current ?? (editor.isNew ? 'New' : title)}
    >
      <Form {...editor.form}>
        <form
          ref={formRef}
          onSubmit={(event) => {
            if (canWrite) editor.onSubmit(event);
            else event.preventDefault();
          }}
          className="flex flex-col gap-8"
          noValidate
          aria-busy={editor.isPending || undefined}
        >
          <div className="flex min-w-0 flex-col gap-8">
            <fieldset disabled={!canWrite} className="min-w-0">
              {layout === 'plain' ? (
                <div className="flex flex-col gap-8">{children}</div>
              ) : (
                <PageSection
                  title={sectionTitle}
                  {...(sectionDescription ? { description: sectionDescription } : {})}
                >
                  <Stack gap={4}>{children}</Stack>
                </PageSection>
              )}
            </fieldset>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {canWrite ? (
                <Button type="submit" className="w-full sm:w-auto" disabled={!editor.canSave}>
                  {editor.isPending ? 'Saving…' : editor.isNew ? createLabel : updateLabel}
                </Button>
              ) : null}
              <Button asChild type="button" variant="secondary" className="w-full sm:w-auto">
                <Link href={listHref}>{canWrite ? 'Cancel' : 'Back to list'}</Link>
              </Button>
            </div>
          </div>

          {!editor.isNew && belowForm ? belowForm : null}

          {!editor.isNew && deleteDescription && ability?.can('delete', subject) ? (
            <InlineDelete
              description={deleteDescription}
              onConfirm={editor.remove.onConfirm}
              isPending={editor.remove.isPending}
            />
          ) : null}
        </form>
      </Form>
    </ManageEditorShell>
  );
}
