import { redirect } from 'next/navigation';
import { currentPrincipal } from '../lib/trpc/context.js';
import { workspaceHome } from '../lib/navigation.js';

/**
 * Land on the first category of the resolved experience, matching Workspace home.
 */
export default async function HomePage(): Promise<never> {
  const principal = await currentPrincipal();
  redirect(
    principal?.kind === 'platform'
      ? '/platform'
      : principal?.kind === 'tenant'
        ? workspaceHome(principal.actor.role)
        : '/machines',
  );
}
