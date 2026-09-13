import { type JSX, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { roleSpaceOf } from '@argoniq/core-domain';
import { currentActor } from '../../../lib/trpc/context.js';

/**
 * Route guard for the OEM control center (Installed Base Portal Management). This
 * is defense in depth, NOT the primary control: every management service already
 * re-authorizes through the policy engine (`assertCan`), and the nav hides these
 * items from companies. This guard stops a customer-role actor from reaching the
 * `/manage/*` surface at all — an out-of-space actor gets a 404 (we do not confirm
 * the surface exists). When the auth seam replaces the dev stub, this keeps working
 * unchanged because it reads the same resolved actor.
 */
export default async function ManageLayout({
  children,
}: {
  children: ReactNode;
}): Promise<JSX.Element> {
  const actor = await currentActor();
  if (!actor || roleSpaceOf(actor.role) !== 'oem_staff') notFound();
  return <>{children}</>;
}
