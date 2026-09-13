import { CaseReceipt } from '../../../../components/case-receipt.js';
import { type JSX } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { CaseId, CASE_STATUS_LABEL, roleSpaceOf } from '@argoniq/core-domain';
import { Button, PageContainer, PageSection } from '@argoniq/ui';
import { serverQuery } from '../../../../lib/trpc/server.js';
import { currentActor } from '../../../../lib/trpc/context.js';
import { routes } from '../../../../lib/routes.js';
import { PageChrome } from '../../../../lib/page-chrome.js';

export default async function CasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}): Promise<JSX.Element> {
  const id = CaseId.safeParse((await params).caseId);
  if (!id.success) notFound();
  const record = await serverQuery(async (api) => {
    try {
      return await api.case.get({ caseId: id.data });
    } catch (error) {
      if (error instanceof TRPCError && error.code === 'NOT_FOUND') return null;
      throw error;
    }
  });
  if (!record) notFound();
  const actor = await currentActor();
  const customer = actor && roleSpaceOf(actor.role) === 'customer';
  const status =
    record.status === 'awaiting_customer' && customer
      ? 'Awaiting you'
      : CASE_STATUS_LABEL[record.status];
  return (
    <PageContainer>
      <PageChrome
        title={record.reference}
        breadcrumbs={[
          { label: customer ? 'Support requests' : 'Cases', href: routes.cases },
          { label: record.reference },
        ]}
        meta={<span className="text-sm font-medium">{status}</span>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <div className="space-y-6">
          <CaseReceipt canRetry={!customer} caseId={record.id} />
          <PageSection title="Reported problem">
            <p className="max-w-prose text-base whitespace-pre-wrap">{record.summary}</p>
            <p className="text-text-muted mt-4 text-xs">
              Opened {new Date(record.createdAt).toISOString().slice(0, 10)}
            </p>
          </PageSection>
        </div>
        <PageSection title="Machine and company">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-text-muted text-xs">Machine</dt>
              <dd>
                {record.machine ? (
                  <Link
                    className="text-accent hover:underline"
                    href={routes.serial(record.machine.id)}
                  >
                    {record.machine.serialNumber}
                  </Link>
                ) : (
                  'Not recorded'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted text-xs">Company</dt>
              <dd>{record.companyName ?? 'Not recorded'}</dd>
            </div>
            <div>
              <dt className="text-text-muted text-xs">Site</dt>
              <dd>{record.siteName ?? 'Not recorded'}</dd>
            </div>
          </dl>
          {record.machine ? (
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <Link href={routes.machineManuals(record.machine.id)}>Open manuals</Link>
            </Button>
          ) : null}
        </PageSection>
      </div>
    </PageContainer>
  );
}
