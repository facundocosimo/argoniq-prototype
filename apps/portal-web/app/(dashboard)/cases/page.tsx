import { type JSX } from 'react';
import Link from 'next/link';
import { roleSpaceOf } from '@argoniq/core-domain';
import { currentActor } from '../../../lib/trpc/context.js';
import { ClipboardList } from 'lucide-react';
import { Button, EmptyState, PageContainer } from '@argoniq/ui';
import { serverQuery } from '../../../lib/trpc/server.js';
import { PageChrome } from '../../../lib/page-chrome.js';
import { CasesTable } from '../../../components/cases-table.js';

/**
 * Support case list. The service returns a customer-safe projection and omits
 * staff-only reasoning. Cases created from the resolution flow carry the available
 * diagnostic context for technician follow-up.
 */
const PAGE_SIZE = 50;

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}): Promise<JSX.Element> {
  const { cursor } = await searchParams;
  const page = await serverQuery((api) =>
    api.case.list({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }),
  );
  const cases = page.items;
  const actor = await currentActor();
  const customer = Boolean(actor && roleSpaceOf(actor.role) === 'customer');
  const title = customer ? 'Support requests' : 'Cases';

  return (
    <PageContainer>
      <PageChrome
        title={title}
        breadcrumbs={[{ label: title }]}
        actions={
          <Button asChild size="sm">
            <Link href="/cases/new">{customer ? 'New support request' : 'New case'}</Link>
          </Button>
        }
      />
      {cases.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-6" aria-hidden />}
          title={customer ? 'No support requests' : 'No cases'}
          description="Open a request from here or from a machine record."
        />
      ) : (
        <CasesTable cases={cases} customer={customer} />
      )}
      <div className="mt-4 flex justify-end gap-2">
        {cursor ? (
          <Button asChild variant="secondary" size="sm">
            <Link href="/cases">Newest</Link>
          </Button>
        ) : null}
        {page.pageInfo.nextCursor ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={`/cases?cursor=${encodeURIComponent(page.pageInfo.nextCursor)}`}>
              Older
            </Link>
          </Button>
        ) : null}
      </div>
    </PageContainer>
  );
}
