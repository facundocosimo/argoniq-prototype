import { type JSX } from 'react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { SerialId, roleSpaceOf } from '@argoniq/core-domain';
import { PageContainer } from '@argoniq/ui';
import { currentActor, resolveSessionChrome } from '../../../../lib/trpc/context.js';
import { PageChrome } from '../../../../lib/page-chrome.js';
import { CaseCreate } from '../../../../components/case-create.js';

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ serialId?: string; draft?: string }>;
}): Promise<JSX.Element> {
  const actor = await currentActor();
  if (!actor) notFound();
  const params = await searchParams;
  const input = params.serialId;
  if (params.draft && !z.uuid().safeParse(params.draft).success) notFound();
  if (input && !SerialId.safeParse(input).success) notFound();
  const chrome = await resolveSessionChrome();
  const customer = roleSpaceOf(actor.role) === 'customer';
  const storageScope = `${actor.userId}:${actor.tenantId}:${actor.role}:${actor.companyId ?? ''}`;
  return (
    <PageContainer>
      <PageChrome
        title={customer ? 'New support request' : 'New case'}
        breadcrumbs={[
          { label: customer ? 'Support requests' : 'Cases', href: '/cases' },
          { label: 'New' },
        ]}
      />
      <CaseCreate
        key={`${storageScope}:${input ?? 'new'}:${params.draft ?? 'direct'}`}
        draftId={params.draft}
        contact={chrome?.identity}
        serialId={input}
        storageScope={storageScope}
      />
    </PageContainer>
  );
}
