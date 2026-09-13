import { DocumentId } from '@argoniq/core-domain';
import { type JSX } from 'react';
import { notFound } from 'next/navigation';
import { defineAbilityFor } from '@argoniq/auth';
import { PageContainer } from '@argoniq/ui';
import { currentActor } from '../../../../../lib/trpc/context.js';
import { serverQuery } from '../../../../../lib/trpc/server.js';
import { PageChrome } from '../../../../../lib/page-chrome.js';
import { DocumentUploader } from '../../../../../components/document-uploader.js';

export default async function UploadDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ previous?: string }>;
}): Promise<JSX.Element> {
  const actor = await currentActor();
  if (!actor || !defineAbilityFor(actor).can('create', 'Document')) notFound();
  const { previous } = await searchParams;
  const initial = previous
    ? (await serverQuery((api) => api.document.get({ documentId: DocumentId.parse(previous) })))
        .document
    : undefined;
  const families = await serverQuery((api) => api.management.listFamilies());
  const models = (
    await Promise.all(
      families.map((family) =>
        serverQuery((api) => api.management.listModels({ familyId: family.id })),
      ),
    )
  ).flat();
  return (
    <PageContainer>
      <PageChrome
        title="Upload document"
        breadcrumbs={[{ label: 'Documents', href: '/manage/documents' }, { label: 'Upload' }]}
      />
      <div className="max-w-3xl">
        <DocumentUploader
          families={families}
          models={models}
          initiallyExpanded
          {...(initial ? { initial, mode: 'revision' as const } : {})}
        />
      </div>
    </PageContainer>
  );
}
