'use client';

import { type JSX, type ReactNode } from 'react';
import Link from 'next/link';
import { Cpu, Gauge, Plus, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { type OptionType } from '@argoniq/core-domain';
import { Button, PageSection, Stack, Text } from '@argoniq/ui';
import { trpc } from '../../lib/trpc/client.js';
import { routes } from '../../lib/routes.js';
import { useWorkspaceAbility } from '../../lib/workspace-access.js';

/**
 * Catalog Studio hubs — the related-items sections rendered beneath a family or model
 * editor (the same "the record is the hub" pattern as CompanyAccount). A family's
 * Models, and a model's Variant axes + Option catalog, are managed in the context of
 * their parent rather than from a standalone registry — which is why neither has its
 * own nav item. Options and axes have rich forms, so each row opens its editor page.
 */

const TYPE_LABEL: Record<OptionType, string> = {
  boolean: 'Yes / no module',
  choice: 'Choice',
  quantity: 'Quantity',
};

/** A bordered list of links with a leading icon + trailing meta, matching the account hub. */
function LinkList<T extends { id: string }>({
  rows,
  href,
  icon,
  primary,
  meta,
  emptyText,
}: {
  rows: T[];
  href: (row: T) => string;
  icon: ReactNode;
  primary: (row: T) => ReactNode;
  meta?: (row: T) => ReactNode;
  emptyText: string;
}): JSX.Element {
  if (rows.length === 0)
    return (
      <Text size="sm" tone="subtle">
        {emptyText}
      </Text>
    );
  return (
    <div className="border-border rounded-md border">
      {rows.map((row, i) => (
        <Link
          key={row.id}
          href={href(row)}
          className={`hover:bg-surface focus-visible:outline-focus flex items-center justify-between gap-4 px-4 py-2.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 ${i < rows.length - 1 ? 'border-border border-b' : ''}`}
        >
          <span className="text-text flex items-center gap-2.5 text-sm">
            <span className="text-text-subtle" aria-hidden>
              {icon}
            </span>
            {primary(row)}
          </span>
          {meta ? (
            <span className="text-text-subtle flex items-center gap-2 text-xs">{meta(row)}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

function AddButton({ href, label }: { href: string; label: string }): JSX.Element | null {
  const ability = useWorkspaceAbility();
  if (!ability?.can('create', 'Catalog')) return null;
  return (
    <Button asChild size="sm" variant="secondary" className="w-fit">
      <Link href={href}>
        <Plus className="size-4" aria-hidden />
        {label}
      </Link>
    </Button>
  );
}

/* ── Models (under a family) ───────────────────────────────────────────────────── */

export function ModelsSection({ familyId }: { familyId: string }): JSX.Element {
  const models = trpc.management.listModels.useQuery({ familyId });
  const rows = models.data ?? [];
  return (
    <PageSection
      title="Models"
      description="The machine models in this family. Each carries its own configuration schema."
    >
      <Stack gap={3} className="max-w-2xl">
        <LinkList
          rows={rows}
          href={(m) => routes.manage.modelsModel(m.id)}
          icon={<Cpu className="size-4" />}
          primary={(m) => m.name}
          meta={(m) => <span className="nums-tabular">{m.key}</span>}
          emptyText="No models yet."
        />
        <AddButton
          href={`${routes.manage.modelsModel('new')}?familyId=${familyId}`}
          label="New model"
        />
      </Stack>
    </PageSection>
  );
}

/* ── Variant axes + Options (under a model) ────────────────────────────────────── */

export function ModelConfigSections({ modelId }: { modelId: string }): JSX.Element {
  return (
    <Stack gap={6}>
      <VariantAxesSection modelId={modelId} />
      <OptionsSection modelId={modelId} />
    </Stack>
  );
}

function VariantAxesSection({ modelId }: { modelId: string }): JSX.Element {
  const axes = trpc.management.listVariantAxes.useQuery({ modelId });
  const rows = axes.data ?? [];
  return (
    <PageSection
      title="Variant axes"
      description="The dimensions along which this model's units differ — a serial resolves a value per axis into its as-built configuration."
    >
      <Stack gap={3} className="max-w-2xl">
        <LinkList
          rows={rows}
          href={(a) => routes.manage.modelsAxis(a.id)}
          icon={<Gauge className="size-4" />}
          primary={(a) => (
            <span className="flex items-center gap-2">
              {a.label}
              {a.safetyRelevant ? (
                <ShieldAlert className="text-zone-red size-3.5" aria-label="safety-relevant" />
              ) : null}
            </span>
          )}
          meta={(a) => <span className="capitalize">{a.dataType}</span>}
          emptyText="No variant axes yet."
        />
        <AddButton
          href={`${routes.manage.modelsAxis('new')}?modelId=${modelId}`}
          label="New axis"
        />
      </Stack>
    </PageSection>
  );
}

function OptionsSection({ modelId }: { modelId: string }): JSX.Element {
  const defs = trpc.management.listOptionDefs.useQuery({ modelId });
  const rows = defs.data ?? [];
  return (
    <PageSection
      title="Option catalog"
      description="Installable modules a unit can carry — present/absent, a chosen level, or a quantity. Machines pick from this catalog on their editor page."
    >
      <Stack gap={3} className="max-w-2xl">
        <LinkList
          rows={rows}
          href={(o) => routes.manage.modelsOption(o.id)}
          icon={<SlidersHorizontal className="size-4" />}
          primary={(o) => (
            <span className="flex items-center gap-2">
              {o.label}
              {o.safetyRelevant ? (
                <ShieldAlert className="text-zone-red size-3.5" aria-label="safety-relevant" />
              ) : null}
            </span>
          )}
          meta={(o) => <span>{TYPE_LABEL[o.optionType]}</span>}
          emptyText="No options yet."
        />
        <AddButton
          href={`${routes.manage.modelsOption('new')}?modelId=${modelId}`}
          label="New option"
        />
      </Stack>
    </PageSection>
  );
}
