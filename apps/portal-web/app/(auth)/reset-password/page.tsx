import Link from 'next/link';
import { AuthForm } from '../../../components/auth-forms.js';
export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  if (!params.token || params.error)
    return (
      <>
        <h1 className="text-2xl font-semibold">This link is no longer valid.</h1>
        <p className="text-text-muted mt-3 text-sm">
          Request another password reset link to continue.
        </p>
        <Link
          href="/forgot-password"
          className="text-accent mt-5 inline-flex min-h-11 items-center text-sm"
        >
          Request a new link
        </Link>
      </>
    );
  return <AuthForm mode="reset" token={params.token} />;
}
