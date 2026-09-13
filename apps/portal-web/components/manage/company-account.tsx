'use client';

import { type JSX } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button, ErrorState, PageSection, Stack, Text } from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { CasesTable } from '../cases-table.js';
import { useWorkspaceAbility } from '../../lib/workspace-access.js';
import { routes } from '../../lib/routes.js';
import { SitesTable } from './sites-list.js';
import { MachinesTable } from './machines-list.js';
import { ContactsSection } from './contacts-list.js';

/**
 * Company account hub (Salesforce-style: the record is the hub). Beneath the identity
 * form, the company's SITES and MACHINES as related lists — the same tables the
 * standalone registries use, scoped to this company. Each list's "New" button sits on
 * the header line and NAVIGATES to the standalone create page pre-filled with this
 * company; never an inline form, never a wizard.
 */
export function CompanyAccount({ companyId }: { companyId: string }): JSX.Element {
  const ability = useWorkspaceAbility();
  const cases = trpc.case.list.useInfiniteQuery(
    { limit: 50, companyId },
    { getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined },
  );
  return (
    <Stack gap={6}>
      <ContactsSection companyId={companyId} />

      <PageSection
        title="Sites"
        description="Locations where this company runs machines."
        actions={
          ability?.can('create', 'Site') ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={`${routes.manage.sites}/new?companyId=${companyId}`}>
                <Plus className="size-4" aria-hidden />
                New site
              </Link>
            </Button>
          ) : null
        }
      >
        <SitesTable companyId={companyId} />
      </PageSection>

      <PageSection
        title="Machines"
        description="Machines this company has been sold."
        actions={
          ability?.can('create', 'Serial') ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={`${routes.manage.machines}/new?companyId=${companyId}`}>
                <Plus className="size-4" aria-hidden />
                New machine
              </Link>
            </Button>
          ) : null
        }
      >
        <MachinesTable companyId={companyId} />
      </PageSection>
      <PageSection title="Cases">
        {cases.error ? (
          <ErrorState title="Could not load cases" description={cases.error.message} />
        ) : cases.isLoading ? (
          <Text tone="muted">Loading cases…</Text>
        ) : (
          <CasesTable cases={cases.data?.pages.flatMap((page) => page.items) ?? []} />
        )}
        {cases.hasNextPage ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={cases.isFetchingNextPage}
            onClick={() => void cases.fetchNextPage()}
          >
            Load more cases
          </Button>
        ) : null}
      </PageSection>
    </Stack>
  );
}
