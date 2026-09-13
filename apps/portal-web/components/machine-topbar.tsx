'use client';

import { type JSX } from 'react';
import { PageHeader, Skeleton } from '@argoniq/ui';
import { trpc } from '../lib/trpc/client.js';
import { SerialStatusText } from './serial-status.js';
import { routes } from '../lib/routes.js';
import { RecordBackLink, TopbarActions } from '../lib/page-chrome.js';

export function MachineTopbar({ serialId }: { serialId: string }): JSX.Element {
  const detail = trpc.machine.getSerialDetail.useQuery({ serialId }, { staleTime: 60_000 });
  const back = <RecordBackLink href={routes.machines} label="Machines" />;

  if (!detail.data) {
    return (
      <PageHeader
        title="Machine"
        back={back}
        meta={
          detail.error ? (
            <p role="alert" className="text-danger text-sm">
              Could not load machine identity.
            </p>
          ) : (
            <Skeleton className="h-4 w-36" />
          )
        }
      />
    );
  }

  const { modelName, serial } = detail.data;
  return (
    <PageHeader
      title={serial.customerTag ?? modelName}
      back={back}
      status={<SerialStatusText status={serial.status} />}
      meta={
        <p className="nums-tabular text-text-muted text-xs">
          Serial: <span className="font-mono">{serial.serialNumber}</span>
          {serial.customerTag ? ` · ${modelName}` : ''}
        </p>
      }
      actions={<TopbarActions />}
    />
  );
}
