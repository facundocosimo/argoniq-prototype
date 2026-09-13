import { type JSX, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { currentPrincipal } from '../../../lib/trpc/context.js';

/**
 * Route guard for the platform (super-admin) console. Only the platform operator
 * may reach `/platform/*`. This is defense in depth alongside the `platformProcedure`
 * transport gate — an OEM/customer principal (or an impersonating session, which is
 * a tenant principal) gets a 404 here. To manage tenants, the operator must exit any
 * active impersonation first.
 */
export default async function PlatformLayout({
  children,
}: {
  children: ReactNode;
}): Promise<JSX.Element> {
  const principal = await currentPrincipal();
  if (principal?.kind !== 'platform') notFound();
  return <>{children}</>;
}
