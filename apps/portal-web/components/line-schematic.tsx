import { type JSX } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { type InstallationStation } from '@argoniq/core-domain';
import { Text } from '@argoniq/ui';
import { StationIcon } from './station-icon.js';

/**
 * Line schematic (composition axis) — the ordered stations of an installation as a
 * left-to-right material flow, one icon per station family, connected by flow
 * chevrons. Each node links to the equipment detail. Scrolls horizontally on
 * narrow viewports so the page body never scrolls sideways.
 */
export function LineSchematic({
  stations,
}: {
  stations: readonly InstallationStation[];
}): JSX.Element {
  return (
    <div className="overflow-x-auto pb-2">
      <ol className="flex items-stretch gap-1" aria-label="Line stations in material-flow order">
        {stations.map((station, index) => (
          <li key={station.serialId} className="flex items-center gap-1">
            <StationNode station={station} />
            {index < stations.length - 1 ? (
              <ChevronRight className="text-text-subtle size-5 shrink-0" aria-label="feeds" />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function StationNode({ station }: { station: InstallationStation }): JSX.Element {
  return (
    <Link
      href={`/machines/${station.serialId}`}
      className="group border-border bg-surface ease-out-fast hover:border-accent focus-visible:outline-focus flex w-40 shrink-0 flex-col gap-2 rounded-md border p-3 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div className="flex items-center justify-between">
        <span className="bg-accent-subtle text-accent flex size-9 items-center justify-center rounded-md">
          <StationIcon iconKey={station.iconKey} className="size-5" />
        </span>
        {station.position != null ? (
          <span className="nums-tabular text-text-subtle text-xs">#{station.position}</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <Text as="span" size="xs" tone="subtle" className="tracking-wide uppercase">
          {station.familyName}
        </Text>
        <span className="text-text group-hover:text-accent text-sm font-medium">
          {station.modelName}
        </span>
        <span className="nums-tabular text-text-muted text-xs">{station.serialNumber}</span>
        {station.manufacturer ? (
          <span className="text-text-subtle mt-0.5 text-xs">via {station.manufacturer}</span>
        ) : null}
      </div>
    </Link>
  );
}
