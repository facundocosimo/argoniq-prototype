'use client';

import { useState, type JSX, type ReactNode } from 'react';
import Link from 'next/link';
import { type useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Button, PageSection, Stack, Text, type useToast } from '@argoniq/ui';
import { PageChrome } from '../../lib/page-chrome.js';
import { useWorkspaceAbility } from '../../lib/workspace-access.js';
import type { SubjectType } from '@argoniq/auth/ability';

/**
 * Shared management-surface kit. Every OEM control-center surface (companies,
 * sites, machines, lines, options) is a list page → a `[id]` editor page, and they
 * all render through these three pieces so titles, return controls, spacing, the "New"
 * affordance, and destructive confirms are identical everywhere. Nothing lives in a
 * dialog: create/edit are pages, delete is an inline confirm.
 */

type Toast = ReturnType<typeof useToast>;
type Router = ReturnType<typeof useRouter>;

/** Map management destinations to the existing service policy subjects. */
export function managementSubject(href: string): SubjectType {
  return href.includes('companies')
    ? 'Company'
    : href.includes('contacts')
      ? 'Contact'
      : href.includes('sites')
        ? 'Site'
        : /machines|lines/.test(href)
          ? 'Serial'
          : 'Catalog';
}

/** Standard mutation success: toast, then navigate (usually back to the list). */
export function manageSaved(
  toast: Toast,
  router: Router,
  message: string,
  href: string,
): () => void {
  return () => {
    toast.success(message);
    router.push(href);
  };
}

/** Standard mutation failure: a danger toast carrying the service's message. */
export function manageFailed(toast: Toast, message: string): (error: { message: string }) => void {
  return (error) => toast.danger(message, { body: error.message });
}

/**
 * List-page shell — one compact title row and the
 * single "New" affordance (a link to the `/new` editor). Children are the table.
 */
export function ManageListShell({
  title,
  newHref,
  newLabel,
  children,
}: {
  title: string;
  newHref: string;
  newLabel: string;
  children: ReactNode;
}): JSX.Element {
  const ability = useWorkspaceAbility();
  const subject = managementSubject(newHref);
  return (
    <>
      <PageChrome
        title={title}
        breadcrumbs={[{ label: title }]}
        actions={
          ability?.can('create', subject) ? (
            <Button asChild size="sm" className="w-full sm:w-auto">
              <Link href={newHref}>
                <Plus className="size-4" aria-hidden />
                {newLabel}
              </Link>
            </Button>
          ) : null
        }
      />
      <Stack gap={4}>{children}</Stack>
    </>
  );
}

/**
 * Editor-page shell — shared record title and one back arrow to its parent,
 * with editor sections as children. Used for both create
 * (`title="New …"`, `current="New"`) and edit.
 */
export function ManageEditorShell({
  title,
  entityLabel,
  listHref,
  current,
  children,
}: {
  title: string;
  entityLabel: string;
  listHref: string;
  current: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <>
      <PageChrome
        title={title}
        breadcrumbs={[{ label: entityLabel, href: listHref }, { label: current }]}
      />
      {children}
    </>
  );
}

/**
 * Inline delete — the one destructive action, as a page section (never a modal).
 * A "Delete" reveals an inline confirm; the confirm uses the `danger` intent and
 * disables while the mutation runs.
 */
export function InlineDelete({
  description,
  confirmLabel = 'Delete permanently',
  buttonLabel = 'Delete',
  onConfirm,
  isPending,
}: {
  description: string;
  confirmLabel?: string;
  buttonLabel?: string;
  onConfirm: () => void;
  isPending: boolean;
}): JSX.Element {
  const [armed, setArmed] = useState(false);
  return (
    <PageSection title="Danger zone">
      <div className="border-danger/40 bg-danger/5 flex flex-col gap-3 rounded-md border p-4">
        <Text size="sm" tone="muted">
          {description}
        </Text>
        {armed ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="danger"
              size="sm"
              className="w-full sm:w-auto"
              onClick={onConfirm}
              disabled={isPending}
            >
              <Trash2 className="size-4" aria-hidden />
              {confirmLabel}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setArmed(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="w-full sm:w-fit"
            onClick={() => setArmed(true)}
          >
            <Trash2 className="size-4" aria-hidden />
            {buttonLabel}
          </Button>
        )}
      </div>
    </PageSection>
  );
}
