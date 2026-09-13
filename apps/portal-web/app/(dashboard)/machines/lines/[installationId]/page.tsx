import { type JSX } from 'react';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { type InstallationDetail } from '@argoniq/core-domain';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Inline,
  PageContainer,
  Stack,
  Text,
} from '@argoniq/ui';
import { serverQuery } from '../../../../../lib/trpc/server.js';
import { routes } from '../../../../../lib/routes.js';
import { PageChrome } from '../../../../../lib/page-chrome.js';
import { LineSchematic } from '../../../../../components/line-schematic.js';

/**
 * Line (installation) detail — the composition axis. A Server Component that reads
 * the installation and its ordered stations through the service layer, then renders
 * the material-flow schematic. Access is decided by the service (customer scope); an
 * out-of-scope or unknown line 404s.
 */
export default async function LineDetailPage({
  params,
}: {
  params: Promise<{ installationId: string }>;
}): Promise<JSX.Element> {
  const { installationId } = await params;

  const detail = await serverQuery(async (api) => {
    try {
      return await api.installation.get({ installationId });
    } catch (error) {
      if (error instanceof TRPCError && error.code === 'NOT_FOUND') return null;
      throw error;
    }
  });

  if (!detail) notFound();

  const { installation, stations } = detail;

  return (
    <PageContainer>
      <PageChrome
        title={installation.name}
        breadcrumbs={[{ label: 'Machines', href: routes.machines }, { label: installation.name }]}
      />
      <Stack gap={4}>
        <Text size="sm" tone="muted">
          A {installation.kind} sold and commissioned as one system — {stations.length} stations in
          material-flow order. Open any station for its as-built configuration and service history.
        </Text>

        <Card>
          <CardHeader>
            <Inline justify="between" align="center" wrap>
              <CardTitle>Line schematic</CardTitle>
              <Text as="span" size="xs" tone="subtle">
                flow: infeed → outfeed
              </Text>
            </Inline>
          </CardHeader>
          <CardBody>
            {stations.length === 0 ? (
              <Text size="sm" tone="muted">
                No stations are registered on this line yet.
              </Text>
            ) : (
              <LineSchematic stations={stations} />
            )}
          </CardBody>
        </Card>

        <LineFactsCard detail={detail} />
      </Stack>
    </PageContainer>
  );
}

function LineFactsCard({ detail }: { detail: InstallationDetail }): JSX.Element {
  const { installation, stations } = detail;
  const boughtIn = stations.filter((s) => s.manufacturer).length;
  const facts: { label: string; value: string }[] = [
    { label: 'Type', value: installation.kind },
    { label: 'Stations', value: String(stations.length) },
    {
      label: 'Commissioned',
      value: installation.commissionedAt ? installation.commissionedAt.toLocaleDateString() : '—',
    },
    {
      label: 'Warranty until',
      value: installation.warrantyExpiresAt
        ? installation.warrantyExpiresAt.toLocaleDateString()
        : '—',
    },
    { label: 'Bought-in stations', value: boughtIn > 0 ? String(boughtIn) : 'none' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Line facts</CardTitle>
      </CardHeader>
      <CardBody>
        <dl className="divide-border divide-y">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <dt className="text-text-muted text-sm">{fact.label}</dt>
              <dd className="text-text text-sm font-medium">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}
