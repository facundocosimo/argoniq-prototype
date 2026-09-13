import { redirect } from 'next/navigation';
import { getEnv } from '@argoniq/core-domain/env';
import { AuthForm } from '../../../components/auth-forms.js';
import { currentIdentityState } from '../../../lib/trpc/context.js';
export default async function LoginPage() {
  const state = await currentIdentityState();
  if (state.kind === 'resolved' && !state.chrome.isDemo) redirect('/');
  if (state.kind === 'select-organization' || state.kind === 'no-access')
    redirect('/select-organization');
  const env = getEnv();
  return (
    <AuthForm
      mode="login"
      recoveryAvailable={
        env.NODE_ENV !== 'production' || !!(env.AUTH_SMTP_URL && env.AUTH_EMAIL_FROM)
      }
    />
  );
}
