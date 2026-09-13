import { getEnv } from '@argoniq/core-domain/env';
import { AuthForm } from '../../../components/auth-forms.js';
export default function RecoveryPage() {
  const env = getEnv();
  if (env.NODE_ENV === 'production' && !(env.AUTH_SMTP_URL && env.AUTH_EMAIL_FROM))
    return (
      <>
        <h1 className="text-2xl font-semibold">Contact your administrator</h1>
        <p className="text-text-muted mt-3 text-sm">
          Password recovery is not available. Your OEM administrator can help restore access.
        </p>
      </>
    );
  return <AuthForm mode="recovery" />;
}
