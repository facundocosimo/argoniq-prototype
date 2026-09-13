'use client';

import { useState, type FormEvent, type JSX } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Loader2, LogOut } from 'lucide-react';
import { Button } from '@argoniq/ui';

type Mode = 'login' | 'recovery' | 'reset';
const FIELD =
  'mt-2 min-h-12 w-full rounded-md border border-border bg-bg px-3 text-base text-text outline-none transition-shadow placeholder:text-text-subtle focus:border-accent focus:ring-2 focus:ring-accent/15';

function reloadAfterAccountChange(destination: '/' | '/login'): void {
  // A full page load ensures the server reads the updated session cookie.
  window.location.assign(destination);
}

export function AuthForm({
  mode,
  token,
  recoveryAvailable = true,
}: {
  mode: Mode;
  token?: string;
  recoveryAvailable?: boolean;
}): JSX.Element {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const emailEntry = values.get('email');
    const passwordEntry = values.get('password');
    const email = typeof emailEntry === 'string' ? emailEntry.trim() : '';
    const password = typeof passwordEntry === 'string' ? passwordEntry : '';
    const endpoint =
      mode === 'login'
        ? 'sign-in/email'
        : mode === 'recovery'
          ? 'request-password-reset'
          : 'reset-password';
    const payload =
      mode === 'login'
        ? { email, password }
        : mode === 'recovery'
          ? { email, redirectTo: '/reset-password' }
          : { token, newPassword: password };
    try {
      const response = await fetch(`/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setError(
          mode === 'login'
            ? 'We could not sign you in. Check your email and password, then try again.'
            : mode === 'reset'
              ? 'This reset link is invalid or has expired. Request a new link.'
              : 'Recovery is temporarily unavailable. Please try again or contact your OEM administrator.',
        );
        return;
      }
      if (mode === 'login') reloadAfterAccountChange('/');
      else setComplete(true);
    } catch {
      setError('We could not connect. Your entries are still here; please try again.');
    } finally {
      setPending(false);
    }
  }
  if (complete)
    return (
      <div className="flex flex-col gap-5">
        <CheckCircle2 className="text-accent size-8" aria-hidden />
        <div role="status">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === 'reset' ? 'Password updated' : 'Check your email'}
          </h1>
          <p className="text-text-muted mt-3 text-sm leading-relaxed">
            {mode === 'reset'
              ? 'Your previous sessions have been signed out. Use your new password to continue.'
              : 'If an account exists for that address, we’ll send a password reset link. You can close this page.'}
          </p>
        </div>
        <Link
          href="/login"
          className="text-accent inline-flex min-h-11 items-center gap-2 text-sm font-medium"
        >
          Back to sign in
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    );
  return (
    <>
      <div className="mb-8">
        <p className="text-text-subtle mb-3 font-mono text-xs tracking-widest uppercase">
          Your service workspace
        </p>
        <h1 className="text-text text-3xl font-semibold tracking-tight">
          {mode === 'login'
            ? 'Welcome back.'
            : mode === 'recovery'
              ? 'Reset your password.'
              : 'Choose a new password.'}
        </h1>
        <p className="text-text-muted mt-3 text-sm leading-relaxed">
          {mode === 'login'
            ? 'Sign in with the account connected to your OEM workspace.'
            : mode === 'recovery'
              ? 'Enter your work email and we’ll send you a reset link.'
              : 'Use at least 12 characters. Choose a password you don’t use elsewhere.'}
        </p>
      </div>
      <form
        onSubmit={(event) => void submit(event)}
        aria-busy={pending}
        className="flex flex-col gap-5"
      >
        {mode !== 'reset' ? (
          <label className="text-text text-sm font-medium">
            Work email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={320}
              placeholder="you@company.com"
              className={FIELD}
            />
          </label>
        ) : null}
        {mode !== 'recovery' ? (
          <label className="text-text text-sm font-medium">
            {mode === 'reset' ? 'New password' : 'Password'}
            <input
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'reset' ? 12 : undefined}
              maxLength={128}
              className={FIELD}
            />
          </label>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="border-zone-red/30 bg-zone-red-subtle text-zone-red rounded-md border p-3 text-sm"
          >
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          disabled={pending || (mode === 'reset' && !token)}
          className="mt-1 w-full"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {mode === 'login'
            ? 'Sign in'
            : mode === 'recovery'
              ? 'Send reset link'
              : 'Save new password'}
          {!pending ? <ArrowRight className="ml-auto size-4" aria-hidden /> : null}
        </Button>
        {mode === 'login' ? (
          recoveryAvailable ? (
            <Link
              href="/forgot-password"
              className="text-text-muted hover:text-accent flex min-h-11 items-center justify-center text-sm"
            >
              Forgot your password?
            </Link>
          ) : (
            <p className="text-text-muted text-sm">
              For password help, contact your OEM administrator.
            </p>
          )
        ) : (
          <Link
            href="/login"
            className="text-text-muted hover:text-accent flex min-h-11 items-center justify-center text-sm"
          >
            Back to sign in
          </Link>
        )}
      </form>
      {mode === 'login' ? (
        <p className="border-border text-text-subtle mt-8 border-t pt-5 text-xs leading-relaxed">
          New to this workspace? Ask your OEM administrator for access. A machine serial number
          alone does not grant an account.
        </p>
      ) : null}
    </>
  );
}

export function OrganizationPicker({
  organizations,
  name,
}: {
  organizations: readonly { tenantId: string; name: string }[];
  name: string;
}): JSX.Element {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function select(tenantId: string): Promise<void> {
    setPending(tenantId);
    setError(null);
    try {
      const response = await fetch('/api/auth/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      if (!response.ok) {
        setError('This workspace is no longer available. Contact its administrator.');
        return;
      }
      reloadAfterAccountChange('/');
    } catch {
      setError('We could not connect. Please try again.');
    } finally {
      setPending(null);
    }
  }
  return (
    <>
      <p className="text-text-subtle mb-3 font-mono text-xs tracking-widest uppercase">
        Signed in as {name}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        {organizations.length ? 'Choose your workspace.' : 'Workspace access needed.'}
      </h1>
      <p className="text-text-muted mt-3 text-sm leading-relaxed">
        {organizations.length
          ? 'Each workspace keeps its machines, manuals and service records separate.'
          : 'Your account is signed in, but it has no active OEM membership. Contact your OEM administrator to request or restore access.'}
      </p>
      <div className="mt-7 flex flex-col gap-3">
        {organizations.map((organization) => (
          <button
            key={organization.tenantId}
            type="button"
            disabled={pending !== null}
            onClick={() => void select(organization.tenantId)}
            className="border-border bg-bg hover:border-accent hover:bg-accent-subtle flex min-h-16 items-center justify-between gap-4 rounded-md border p-4 text-left text-sm font-medium transition-colors disabled:opacity-60"
          >
            <span className="min-w-0 break-words">{organization.name}</span>
            {pending === organization.tenantId ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <ArrowRight className="text-text-subtle size-4 shrink-0" aria-hidden />
            )}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-zone-red mt-4 text-sm">
          {error}
        </p>
      ) : null}
      <div className="mt-7">
        <SignOutButton />
      </div>
    </>
  );
}

export function SignOutButton(): JSX.Element {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function signOut(): Promise<void> {
    setPending(true);
    setError(false);
    try {
      const response = await fetch('/api/auth/sign-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error('Sign out failed');
      reloadAfterAccountChange('/login');
    } catch {
      setError(true);
      setPending(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={pending}
        className="text-text-muted hover:text-text inline-flex min-h-11 items-center gap-2 text-sm"
      >
        <LogOut className="size-4" aria-hidden />
        {pending ? 'Signing out…' : 'Sign out'}
      </button>
      {error ? (
        <p role="alert" className="text-zone-red text-xs">
          Unable to sign out. Please retry.
        </p>
      ) : null}
    </>
  );
}
