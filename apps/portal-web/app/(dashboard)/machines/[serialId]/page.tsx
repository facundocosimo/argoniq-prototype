import { type JSX } from 'react';
import { createPolicyEngine } from '@argoniq/auth';
import { currentActor } from '../../../../lib/trpc/context.js';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { type EffectiveConfig, type EffectiveConfigAttribute } from '@argoniq/core-domain';
import { Button, ConfidenceText, PageContainer, PageSection, Stack, Text } from '@argoniq/ui';
import { serverQuery } from '../../../../lib/trpc/server.js';
import { routes } from '../../../../lib/routes.js';
import { PageChrome } from '../../../../lib/page-chrome.js';
import { ConfigSourceText } from '../../../../components/config-source.js';
import { EquipmentOptionsCard } from '../../../../components/equipment-options.js';
import { MachineTagEditor } from '../../../../components/machine-tag-editor.js';

export default async function SerialDetailPage({
  params,
}: {
  params: Promise<{ serialId: string }>;
}): Promise<JSX.Element> {
  const { serialId } = await params;
  const data = await serverQuery(async (api) => {
    try {
      const [detail, config, options] = await Promise.all([
        api.machine.getSerialDetail({ serialId }),
        api.machine.resolveConfig({ serialId }),
        api.machine.resolveOptions({ serialId }),
      ]);
      return { detail, config, options };
    } catch (error) {
      if (error instanceof TRPCError && error.code === 'NOT_FOUND') return null;
      throw error;
    }
  });
  if (!data) notFound();

  const { detail, config, options } = data;
  const actor = await currentActor();
  const policy = actor ? createPolicyEngine(actor) : null;
  const machineScope = { id: detail.serial.id, companyId: detail.serial.companyId };
  const canEdit = policy?.can('manage', 'Serial');
  // Match the existing tag policy without offering a mutation to read-only staff.
  const canEditTag = policy?.can('update', 'Serial', machineScope);
  const canReadCompany = policy?.can('read', 'Company');
  const canReport = policy?.can('create', 'Case', { companyId: detail.serial.companyId });

  return (
    <PageContainer>
      <PageChrome
        title={detail.serial.serialNumber}
        breadcrumbs={[
          { label: 'Machines', href: routes.machines },
          { label: detail.serial.serialNumber },
        ]}
        actions={
          <>
            {canReport ? (
              <Button asChild size="sm">
                <Link href={`${routes.cases}/new?serialId=${detail.serial.id}`}>
                  Report a problem
                </Link>
              </Button>
            ) : null}
            {canEdit ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={`${routes.manage.machines}/${detail.serial.id}`}>Edit machine</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <Stack gap={6}>
        <section aria-label="Machine details" className="flex flex-col gap-4 sm:flex-row">
          {detail.modelImageUrl ? (
            <div
              role="img"
              aria-label={`${detail.modelName} illustration`}
              className="border-border h-20 w-28 shrink-0 rounded-md border bg-white bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url("${detail.modelImageUrl}")` }}
            />
          ) : null}
          <dl className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-text-muted mb-1 text-xs">Owner</dt>
              <dd className="text-sm font-medium">
                {canReadCompany ? (
                  <Link
                    href={`${routes.manage.companies}/${detail.serial.companyId}`}
                    className="text-accent hover:underline"
                  >
                    {detail.companyName}
                  </Link>
                ) : (
                  detail.companyName
                )}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted mb-1 text-xs">Product family</dt>
              <dd className="text-sm">{detail.familyName}</dd>
            </div>
            <div>
              <dt className="text-text-muted mb-1 text-xs">Factory tag</dt>
              <dd className="text-sm">
                {canEditTag ? (
                  <MachineTagEditor
                    serialId={detail.serial.id}
                    initialTag={detail.serial.customerTag}
                  />
                ) : (
                  (detail.serial.customerTag ?? 'Not recorded')
                )}
              </dd>
            </div>
            {detail.installationId ? (
              <div>
                <dt className="text-text-muted mb-1 text-xs">Installation</dt>
                <dd className="text-sm">
                  <Link
                    href={routes.line(detail.installationId)}
                    className="text-accent hover:underline"
                  >
                    Open production line
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
        <EffectiveConfiguration config={config} />
        {options.length > 0 ? <EquipmentOptionsCard options={options} /> : null}
      </Stack>
    </PageContainer>
  );
}

/** Configuration is a definition list, with aligned source/confidence columns on
 * desktop and explicit labels per value on narrow screens. */
function EffectiveConfiguration({ config }: { config: EffectiveConfig }): JSX.Element {
  return (
    <PageSection title="Configuration">
      {config.attributes.length === 0 ? (
        <Text size="sm" tone="muted">
          No configuration recorded. Confirm the specifications with the manufacturer before
          following instructions that depend on them.
        </Text>
      ) : (
        <div className="border-border bg-bg overflow-hidden rounded-md border">
          <div
            aria-hidden
            className="border-border bg-surface-subtle text-text-muted hidden grid-cols-[minmax(10rem,1fr)_minmax(0,2fr)_9rem_9rem] gap-4 border-b px-4 py-2 text-xs font-medium lg:grid"
          >
            <span>Setting</span>
            <span>Value</span>
            <span>Source</span>
            <span>Confidence</span>
          </div>
          <dl className="divide-border divide-y">
            {config.attributes.map((attribute) => (
              <AttributeRow key={attribute.key} attribute={attribute} />
            ))}
          </dl>
        </div>
      )}
    </PageSection>
  );
}

function AttributeRow({ attribute }: { attribute: EffectiveConfigAttribute }): JSX.Element {
  return (
    <div className="grid gap-x-4 gap-y-1 px-4 py-3 lg:grid-cols-[minmax(10rem,1fr)_minmax(0,2fr)_9rem_9rem] lg:items-baseline">
      <dt className="text-text-muted text-sm">{attribute.label}</dt>
      <dd className="nums-tabular min-w-0 text-sm font-medium break-words">
        {String(attribute.value)}
      </dd>
      <dd className="text-xs">
        <span className="lg:sr-only">Source: </span>
        <ConfigSourceText source={attribute.source} />
      </dd>
      <dd className="text-xs">
        <span className="sr-only">Confidence: </span>
        <ConfidenceText band={attribute.confidence} />
      </dd>
    </div>
  );
}
