import { type JSX } from 'react';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { PageChrome } from '../../../../../lib/page-chrome.js';
import { serverQuery } from '../../../../../lib/trpc/server.js';
import { routes } from '../../../../../lib/routes.js';
import { ResolveConsole, type ResolveMachine } from '../../../../../components/resolve-console.js';

/**
 * Machine-specific troubleshooting entry point. The service classifies a question,
 * operating check, or reported problem, then returns a cited answer, asks a diagnostic
 * question, or recommends support. The serial in the route supplies machine context;
 * unknown or inaccessible serials return not found.
 */
export default async function MachineResolvePage({
  params,
}: {
  params: Promise<{ serialId: string }>;
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

  const machine: ResolveMachine = {
    serialNumber: detail.serial.serialNumber,
    modelName: detail.modelName,
    familyName: detail.familyName,
  };

  return (
    <>
      <PageChrome
        title="Get an answer"
        breadcrumbs={[
          { label: 'Machines', href: routes.machines },
          { label: detail.serial.serialNumber, href: routes.serial(serialId) },
          { label: 'Get an answer' },
        ]}
      />
      <ResolveConsole serialId={serialId} machine={machine} />
    </>
  );
}
