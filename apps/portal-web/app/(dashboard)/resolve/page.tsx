import { redirect } from 'next/navigation';
import { routes } from '../../../lib/routes.js';

/**
 * Legacy redirect. "Get an answer" is now a machine-scoped tool at
 * `/machines/{serial}/resolve` (Asset-360). Old links (`/resolve?serial=…`) forward to
 * the machine workspace; without a serial, back to the installed base to pick one.
 */
export default async function ResolveRedirect({
  searchParams,
}: {
  searchParams: Promise<{ serial?: string }>;
}): Promise<never> {
  const { serial } = await searchParams;
  redirect(serial ? routes.machineResolve(serial) : routes.machines);
}
