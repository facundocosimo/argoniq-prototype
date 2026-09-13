import Link from 'next/link';
import { defineAbilityFor } from '@argoniq/auth';
import { type JSX } from 'react';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { BookText } from 'lucide-react';
import { SerialId } from '@argoniq/core-domain';
import { EmptyState, PageContainer, Stack, Text } from '@argoniq/ui';
import { serverQuery } from '../../../../../lib/trpc/server.js';
import { currentActor } from '../../../../../lib/trpc/context.js';
import { PageChrome } from '../../../../../lib/page-chrome.js';
import { routes } from '../../../../../lib/routes.js';
import { TechnicalInformationTable } from '../../../../../components/technical-information-table.js';
import {
  DocumentUploader,
  type FamilyOption,
  type ModelOption,
} from '../../../../../components/document-uploader.js';

/**
 * Manuals available for this machine. The service filters by family, access tier,
 * and customer scope. Each result opens in the document viewer. OEM staff can also
 * upload a document and assign its family or model scope.
 */
const PAGE_SIZE = 50;

export default async function MachineManualsPage({
  params,
  searchParams,
}: {
  params: Promise<{ serialId: string }>;
  searchParams: Promise<{ cursor?: string }>;
}): Promise<JSX.Element> {
  const { serialId } = await params;

  const detail = await serverQuery(async (api) => {
    try {
      return await api.machine.getSerialDetail({ serialId });
    } catch (error) {
      if (error instanceof TRPCError && error.code === 'NOT_FOUND') return null;
      throw error;
    }
  });
  if (!detail) notFound();

  const { cursor } = await searchParams;
  const page = await serverQuery((api) =>
    api.document.list({
      serialId: SerialId.parse(serialId),
      limit: PAGE_SIZE,
      ...(cursor ? { cursor } : {}),
    }),
  );
  const documents = page.items;

  const actor = await currentActor();
  const isOemStaff = actor !== null && defineAbilityFor(actor).can('create', 'Document');

  // Scope pickers for the uploader (OEM staff only) — families + their models.
  let families: FamilyOption[] = [];
  let models: ModelOption[] = [];
  if (isOemStaff) {
    const familyRows = await serverQuery((api) => api.management.listFamilies());
    families = familyRows.map((f) => ({ id: f.id, name: f.name }));
    const perFamily = await Promise.all(
      familyRows.map((f) => serverQuery((api) => api.management.listModels({ familyId: f.id }))),
    );
    models = perFamily.flat().map((m) => ({ id: m.id, familyId: m.familyId, name: m.name }));
  }

  return (
    <PageContainer>
      <PageChrome
        title="Manuals"
        breadcrumbs={[
          { label: 'Machines', href: routes.machines },
          { label: detail.serial.serialNumber, href: routes.serial(serialId) },
          { label: 'Manuals' },
        ]}
      />
      <Stack gap={4}>
        <Text size="sm" tone="muted">
          The latest approved manuals, service procedures, drawings, and declarations for the{' '}
          {detail.modelName} — the same controlled sources ArgonIQ cites when it resolves an issue
          on this machine.
        </Text>

        {isOemStaff && (
          <DocumentUploader
            families={families}
            models={models}
            initial={{
              tier: 'T2',
              familyId: detail.serial.familyId,
              modelId: detail.serial.modelId,
              companyId: detail.serial.companyId,
              serialId: detail.serial.id,
            }}
          />
        )}

        {documents.length === 0 ? (
          <EmptyState
            icon={<BookText className="size-6" aria-hidden />}
            title="No documents yet"
            description={
              isOemStaff
                ? 'Upload a draft above, then review and publish it for this machine.'
                : 'Approved technical information appears here once your OEM publishes it for this machine’s family.'
            }
          />
        ) : (
          <TechnicalInformationTable documents={documents} canManage={isOemStaff} />
        )}
        <div className="flex min-h-11 gap-4">
          {cursor && (
            <Link className="text-accent" href={`/machines/${serialId}/manuals`}>
              First page
            </Link>
          )}
          {page.pageInfo.nextCursor && (
            <Link
              className="text-accent"
              href={`/machines/${serialId}/manuals?cursor=${encodeURIComponent(page.pageInfo.nextCursor)}`}
            >
              More manuals
            </Link>
          )}
        </div>
      </Stack>
    </PageContainer>
  );
}
