'use client';

import { type JSX } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Skeleton } from '@argoniq/ui';
import { trpc } from '../lib/trpc/client.js';
import { routes } from '../lib/routes.js';
import { StationIcon } from './station-icon.js';

/**
 * MachineNavHeader — the machine-context band at the top of the sidebar (Asset-360):
 * a "back to all machines" escape hatch above the ACTIVE machine's identity, so the
 * operator always sees which machine these tools belong to. The identity is a small
 * schematic-icon tile beside a two-line label (the customer factory tag leads when set,
 * otherwise the model, with the serial beneath) — the tile gives it structure and a
 * clean indent. Reads the cached `getSerialDetail` (free); a skeleton holds the space.
 * Collapses to a bare back chevron on the rail.
 */
export function MachineNavHeader({
  serialId,
  collapsed = false,
}: {
  serialId: string;
  collapsed?: boolean;
}): JSX.Element {
  const detail = trpc.machine.getSerialDetail.useQuery({ serialId }, { staleTime: 60_000 });

  if (collapsed) {
    return (
      <Link
        href={routes.machines}
        aria-label="All machines"
        title="All machines"
        className="text-sidebar-text-subtle ease-out-fast hover:bg-sidebar-hover hover:text-sidebar-text focus-visible:outline-focus mx-auto flex size-8 items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Link>
    );
  }

  const data = detail.data;
  const primary = data ? (data.serial.customerTag ?? data.modelName) : null;
  const secondary = data
    ? data.serial.customerTag
      ? `${data.modelName} · ${data.serial.serialNumber}`
      : data.serial.serialNumber
    : null;

  return (
    <div className="flex flex-col gap-2.5">
      <Link
        href={routes.machines}
        className="group text-sidebar-text-subtle ease-out-fast hover:text-sidebar-text focus-visible:outline-focus inline-flex w-fit items-center gap-1 rounded text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ChevronLeft
          className="ease-out-fast size-3.5 shrink-0 transition-transform duration-150 group-hover:-translate-x-0.5"
          aria-hidden
        />
        All machines
      </Link>

      <div className="flex items-center gap-2.5 pl-0.5">
        <span className="border-sidebar-border bg-sidebar-elevated flex size-9 shrink-0 items-center justify-center rounded-md border">
          {data ? (
            <StationIcon iconKey={data.familyIconKey} className="text-sidebar-text-muted size-5" />
          ) : (
            <Skeleton className="size-5 rounded" />
          )}
        </span>
        <div className="flex min-w-0 flex-col leading-tight">
          {data ? (
            <>
              <span className="text-sidebar-text truncate text-sm font-semibold">{primary}</span>
              <span className="nums-tabular text-sidebar-text-subtle truncate text-xs">
                {secondary}
              </span>
            </>
          ) : (
            <>
              <Skeleton className="mb-1 h-3.5 w-24" />
              <Skeleton className="h-3 w-16" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
