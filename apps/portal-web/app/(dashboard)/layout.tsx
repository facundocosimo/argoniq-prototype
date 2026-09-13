import { type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AppShellClient } from '../../components/app-shell-client.js';
import { currentIdentityState, currentPersonaKey } from '../../lib/trpc/context.js';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const state = await currentIdentityState();
  if (state.kind === 'unauthenticated') redirect('/login');
  if (state.kind === 'select-organization' || state.kind === 'no-access')
    redirect('/select-organization');
  return (
    <AppShellClient
      tenantName={state.chrome.tenantName}
      session={state.chrome}
      activePersonaKey={state.chrome.isDemo ? await currentPersonaKey() : null}
    >
      {children}
    </AppShellClient>
  );
}
