'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Search,
  Table2,
  Workflow,
  X,
} from 'lucide-react';
import {
  type InstalledBaseLine,
  type InstalledBaseStatus,
  type InstalledBaseTree,
  type InstalledBaseUnit,
} from '@argoniq/core';
import { Button, cn, EmptyState } from '@argoniq/ui';
import { routes } from '../lib/routes.js';
import { StationIcon } from './station-icon.js';

const STATUS_META: Record<InstalledBaseStatus, { label: string; tone: string; dot: string }> = {
  operational: { label: 'No open cases', tone: 'text-text-muted', dot: 'bg-text-subtle' },
  disrupted: { label: 'Open service case', tone: 'text-zone-amber', dot: 'bg-zone-amber' },
  down: { label: 'Safety escalation', tone: 'text-zone-red', dot: 'bg-zone-red' },
  maintenance: { label: 'Under maintenance', tone: 'text-accent', dot: 'bg-accent' },
  not_installed: { label: 'Not installed', tone: 'text-text-muted', dot: 'bg-text-subtle' },
  decommissioned: { label: 'Decommissioned', tone: 'text-text-subtle', dot: 'bg-text-subtle' },
};
const VIEW_KEY = 'argoniq_ib_view';
type Filter = 'all' | 'cases' | 'not_installed';

function StatusLabel({ status }: { status: InstalledBaseStatus }): JSX.Element {
  const meta = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center gap-2 text-xs font-medium', meta.tone)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

/** Search the authorized installed base. Phone cards are independent of desktop view preference. */
export function InstalledBaseView({ tree }: { tree: InstalledBaseTree }): JSX.Element {
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_KEY);
      if (saved === 'table' || saved === 'cards') setView(saved);
    } catch {
      /* Display remains usable when browser storage is unavailable. */
    }
  }, []);
  const allUnits = useMemo(
    () => [...tree.lines.flatMap((line) => line.units), ...tree.standalone],
    [tree],
  );
  const filtered = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const matches = (unit: InstalledBaseUnit, lineName = ''): boolean => {
      const haystack = [
        unit.modelName,
        unit.familyName,
        unit.serialNumber,
        unit.customerTag,
        unit.companyName,
        unit.siteName,
        lineName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();
      return (
        terms.every((term) => haystack.includes(term)) &&
        (filter === 'all' ||
          (filter === 'cases' ? unit.openCases > 0 : unit.lifecycleStatus === 'not_installed'))
      );
    };
    return {
      lines: tree.lines
        .map((line) => ({ ...line, units: line.units.filter((unit) => matches(unit, line.name)) }))
        .filter((line) => line.units.length > 0 || (filter === 'all' && terms.length === 0)),
      standalone: tree.standalone.filter((unit) => matches(unit)),
    };
  }, [tree, query, filter]);
  const visibleCount =
    filtered.standalone.length +
    filtered.lines.reduce((count, line) => count + line.units.length, 0);
  const chooseView = (next: 'table' | 'cards'): void => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* Preference storage is optional. */
    }
  };
  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All machines', count: allUnits.length },
    {
      key: 'cases',
      label: 'With open cases',
      count: allUnits.filter((unit) => unit.openCases > 0).length,
    },
    {
      key: 'not_installed',
      label: 'Not installed',
      count: allUnits.filter((unit) => unit.lifecycleStatus === 'not_installed').length,
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="group"
            aria-label="Filter machines"
            className="flex flex-wrap items-center gap-1"
          >
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm transition-colors',
                  filter === item.key
                    ? 'bg-text text-bg'
                    : 'text-text-muted hover:bg-surface hover:text-text',
                )}
              >
                {item.label}
                <span
                  className={cn(
                    'font-mono text-xs tabular-nums',
                    filter === item.key ? 'opacity-80' : 'text-text-subtle',
                  )}
                >
                  {item.count}
                </span>
              </button>
            ))}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative flex min-w-0 flex-1 items-center lg:w-80">
              <Search
                className="text-text-subtle pointer-events-none absolute left-3 size-4"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search machines by serial, model, factory tag, customer or site"
                placeholder="Serial, model, factory tag…"
                className="border-border bg-bg text-text placeholder:text-text-subtle min-h-11 w-full rounded-md border pr-11 pl-10 text-base sm:text-sm"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear machine search"
                  className="text-text-muted hover:text-text absolute right-0 flex size-11 items-center justify-center"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <div
              role="group"
              aria-label="Desktop display mode"
              className="border-border bg-bg hidden shrink-0 rounded-md border p-0.5 xl:flex"
            >
              {(
                [
                  { key: 'table', icon: Table2, label: 'Table view' },
                  { key: 'cards', icon: LayoutGrid, label: 'Card view' },
                ] as const
              ).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={view === key}
                  onClick={() => chooseView(key)}
                  className={cn(
                    'flex size-10 items-center justify-center rounded',
                    view === key
                      ? 'bg-surface-subtle text-text'
                      : 'text-text-subtle hover:text-text',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="text-text-subtle flex flex-wrap items-center justify-between gap-2 text-xs">
          <p role="status" aria-live="polite">
            <span className="text-text font-mono tabular-nums">{visibleCount}</span>{' '}
            {visibleCount === 1 ? 'machine' : 'machines'}
            {query || filter !== 'all' ? ` of ${allUnits.length}` : ''}
            {tree.lines.length > 0
              ? ` · ${tree.lines.length} ${tree.lines.length === 1 ? 'installation' : 'installations'}`
              : ''}
          </p>
          <p>Service records, not live machine monitoring.</p>
        </div>
      </div>
      {visibleCount === 0 && filtered.lines.length === 0 ? (
        <EmptyState
          icon={<Search className="size-6" aria-hidden />}
          title="No matching machines"
          description="Try another serial, model, customer or site."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="xl:hidden">
            <InstalledBaseCards tree={filtered} />
          </div>
          <div className="hidden xl:block">
            {view === 'table' ? (
              <InstalledBaseTable tree={filtered} />
            ) : (
              <InstalledBaseCards tree={filtered} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function InstalledBaseTable({ tree }: { tree: InstalledBaseTree }): JSX.Element {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string): void =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="border-border bg-bg overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-left text-sm">
          <caption className="sr-only">Authorized machines, grouped by installation</caption>
          <thead className="border-border bg-surface border-b">
            <tr>
              {['Machine / serial', 'Company / site', 'Installed', 'Service / lifecycle'].map(
                (label) => (
                  <th
                    key={label}
                    scope="col"
                    className="text-text-muted px-4 py-3 text-xs font-medium"
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {tree.lines.map((line) => (
              <LineRows
                key={line.installationId}
                line={line}
                collapsed={collapsed.has(line.installationId)}
                onToggle={() => toggle(line.installationId)}
              />
            ))}
            {tree.standalone.length > 0 ? (
              <>
                <tr className="border-border bg-surface border-y">
                  <th
                    colSpan={4}
                    scope="rowgroup"
                    className="text-text-muted px-4 py-2 text-xs font-medium"
                  >
                    Standalone equipment{' '}
                    <span className="text-text-subtle ml-2 font-mono">
                      {tree.standalone.length}
                    </span>
                  </th>
                </tr>
                {tree.standalone.map((unit) => (
                  <UnitRow key={unit.serialId} unit={unit} />
                ))}
              </>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LineRows({
  line,
  collapsed,
  onToggle,
}: {
  line: InstalledBaseLine;
  collapsed: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <>
      <tr className="border-border bg-surface border-y">
        <th colSpan={4} scope="rowgroup" className="px-3 py-1 font-normal">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={!collapsed}
              aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${line.name}`}
              className="text-text-muted hover:bg-bg flex size-10 items-center justify-center rounded"
            >
              {collapsed ? (
                <ChevronRight className="size-4" aria-hidden />
              ) : (
                <ChevronDown className="size-4" aria-hidden />
              )}
            </button>
            <Workflow className="text-text-subtle size-4" aria-hidden />
            <Link
              href={routes.line(line.installationId)}
              className="text-text hover:text-accent min-w-0 font-medium break-words"
            >
              {line.name}
            </Link>
            <span className="text-text-subtle ml-auto shrink-0 pr-1 font-mono text-xs">
              {line.units.length} stations
            </span>
          </div>
        </th>
      </tr>
      {!collapsed
        ? line.units.map((unit) => <UnitRow key={unit.serialId} unit={unit} indented />)
        : null}
    </>
  );
}

function UnitRow({
  unit,
  indented = false,
}: {
  unit: InstalledBaseUnit;
  indented?: boolean;
}): JSX.Element {
  return (
    <tr className="border-border/70 hover:bg-surface/60 border-b transition-colors last:border-0">
      <th scope="row" className={cn('px-4 py-4 font-normal', indented && 'pl-8')}>
        <div className="flex items-center gap-3">
          <span className="border-border bg-surface text-text-muted flex size-9 shrink-0 items-center justify-center rounded-md border">
            <StationIcon iconKey={unit.iconKey} className="size-4" />
          </span>
          <div className="min-w-0">
            <Link
              href={routes.serial(unit.serialId)}
              className="text-text hover:text-accent font-medium break-words"
            >
              {unit.customerTag ?? unit.modelName}
            </Link>
            <p className="text-text-subtle mt-0.5 font-mono text-xs">{unit.serialNumber}</p>
            {unit.customerTag ? (
              <p className="text-text-muted mt-0.5 text-xs">{unit.modelName}</p>
            ) : null}
          </div>
        </div>
      </th>
      <td className="px-4 py-4">
        <p className="text-text-muted">{unit.companyName ?? 'Not assigned'}</p>
        <p className="text-text-subtle mt-0.5 text-xs">{unit.siteName ?? 'No site recorded'}</p>
      </td>
      <td className="text-text-muted px-4 py-4 font-mono text-xs">
        {unit.installedYear ?? 'Not recorded'}
      </td>
      <td className="px-4 py-4">
        <StatusLabel status={unit.status} />
        {unit.openCases > 1 ? (
          <p className="text-text-subtle mt-1 text-xs">{unit.openCases} open cases</p>
        ) : null}
      </td>
    </tr>
  );
}

function InstalledBaseCards({ tree }: { tree: InstalledBaseTree }): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      {tree.lines.map((line) => (
        <section key={line.installationId} aria-label={line.name} className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <Workflow className="text-text-subtle size-4 shrink-0" aria-hidden />
            <Link
              href={routes.line(line.installationId)}
              className="text-text hover:text-accent min-w-0 text-sm font-semibold break-words"
            >
              {line.name}
            </Link>
            <span className="text-text-subtle ml-auto shrink-0 font-mono text-xs">
              {line.units.length} stations
            </span>
          </div>
          <ul className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {line.units.map((unit) => (
              <li key={unit.serialId} className="min-w-0">
                <UnitCard unit={unit} />
              </li>
            ))}
          </ul>
          {line.units.length === 0 ? (
            <p className="border-border text-text-muted rounded-md border border-dashed p-4 text-sm">
              No machines assigned to this installation.
            </p>
          ) : null}
        </section>
      ))}
      {tree.standalone.length > 0 ? (
        <section aria-label="Standalone equipment">
          {tree.lines.length > 0 ? (
            <h2 className="text-text mb-3 text-sm font-semibold">Standalone equipment</h2>
          ) : null}
          <ul className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {tree.standalone.map((unit) => (
              <li key={unit.serialId} className="min-w-0">
                <UnitCard unit={unit} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function UnitCard({ unit }: { unit: InstalledBaseUnit }): JSX.Element {
  return (
    <Link
      href={routes.serial(unit.serialId)}
      className="group border-border bg-bg hover:border-border-strong hover:bg-surface/50 flex h-full min-w-0 flex-col rounded-lg border p-4 transition-colors"
    >
      <div className="flex items-start gap-3">
        <span className="border-border bg-surface text-text-muted flex size-10 shrink-0 items-center justify-center rounded-md border">
          <StationIcon iconKey={unit.iconKey} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-text text-sm font-semibold break-words">
            {unit.customerTag ?? unit.modelName}
          </h3>
          <p className="text-text-muted mt-1 font-mono text-xs break-all">{unit.serialNumber}</p>
        </div>
        <ArrowUpRight
          className="text-text-subtle group-hover:text-accent size-4 shrink-0 transition-colors"
          aria-hidden
        />
      </div>
      <p className="text-text-subtle mt-3 text-xs break-words">
        {[unit.companyName, unit.siteName].filter(Boolean).join(' · ') || 'Location not recorded'}
      </p>
      <div className="border-border mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <StatusLabel status={unit.status} />
        {unit.installedYear ? (
          <span className="text-text-subtle font-mono text-xs">Installed {unit.installedYear}</span>
        ) : null}
      </div>
    </Link>
  );
}
