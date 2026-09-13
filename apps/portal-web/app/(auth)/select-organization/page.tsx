import { redirect } from 'next/navigation';
import { OrganizationPicker } from '../../../components/auth-forms.js';
import { currentIdentityState } from '../../../lib/trpc/context.js';
export default async function SelectOrganizationPage() {
  const state = await currentIdentityState();
  if (state.kind === 'unauthenticated') redirect('/login');
  if (state.kind === 'resolved') {
    if (state.chrome.mode === 'platform' || state.chrome.isDemo) redirect('/machines');
    return (
      <OrganizationPicker
        organizations={state.chrome.organizations}
        name={state.chrome.identity.name}
      />
    );
  }
  return (
    <OrganizationPicker
      organizations={state.kind === 'no-access' ? [] : state.organizations}
      name={state.identity.name}
    />
  );
}
