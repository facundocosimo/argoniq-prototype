'use client';

import { type JSX, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  House,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import {
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@argoniq/ui';
import { toggleTheme, useTheme } from '../lib/use-theme.js';
import { PERSONAS } from '../lib/demo/personas.js';
import { switchPersona } from '../lib/demo/switch.js';
import { type WorkspaceIdentityProps } from './workspace-identity.js';

function reloadAfterSignOut(): void {
  // A full page load ensures the server reads the cleared session cookie.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign('/login');
}

export function UserMenu({
  roleLabel,
  identity,
  isDemo,
  workspace,
  activePersonaKey,
  homeHref,
  canSwitchWorkspace,
}: {
  roleLabel: string;
  identity: { name: string; email: string };
  isDemo: boolean;
  workspace: WorkspaceIdentityProps;
  activePersonaKey: string | null;
  homeHref: string;
  canSwitchWorkspace: boolean;
}): JSX.Element {
  const { theme } = useTheme();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [showPersonas, setShowPersonas] = useState(false);
  const personaBackRef = useRef<HTMLDivElement>(null);
  const personaSwitchRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Keep keyboard focus inside the menu when its persona view replaces items.
    (showPersonas ? personaBackRef : personaSwitchRef).current?.focus();
  }, [showPersonas]);
  const initials = identity.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .filter(Boolean);
  const avatarLabel = [initials[0], initials.length > 1 ? initials[initials.length - 1] : ''].join(
    '',
  );
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
      reloadAfterSignOut();
    } catch {
      setError(true);
      setPending(false);
    }
  }
  return (
    <>
      <DropdownMenu onOpenChange={() => setShowPersonas(false)}>
        <DropdownMenuTrigger
          aria-label={`Account and workspace: ${identity.name}, ${roleLabel}${isDemo ? ', demo' : ''}`}
          title={`${identity.name} · ${roleLabel}`}
          className="group text-text hover:bg-surface data-[state=open]:bg-surface flex min-h-11 w-28 shrink-0 items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors sm:w-52"
        >
          <Avatar
            tone="neutral"
            initials={avatarLabel}
            className="border-border hidden border sm:inline-flex"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm leading-4 font-medium">{identity.name}</span>
            <span className="text-text-muted mt-0.5 text-xs leading-4 sm:truncate">
              Role: {roleLabel}
              {isDemo ? ' · demo' : ''}
            </span>
          </span>
          <ChevronDown
            className="text-text-muted size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="bottom"
          align="end"
          className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto"
        >
          {isDemo && showPersonas ? (
            <>
              <DropdownMenuItem
                ref={personaBackRef}
                onSelect={(event) => {
                  event.preventDefault();
                  setShowPersonas(false);
                }}
              >
                <ArrowLeft className="text-text-muted size-4" aria-hidden />
                Back to account
              </DropdownMenuItem>
              <DropdownMenuLabel className="pt-3">Switch development persona</DropdownMenuLabel>
              {PERSONAS.map((persona) => (
                <DropdownMenuItem
                  key={persona.key}
                  onSelect={() => void switchPersona(persona.key)}
                  className="min-h-11"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span>{persona.roleLabel}</span>
                    <span className="text-text-muted text-xs">{persona.group}</span>
                  </span>
                  {persona.key === activePersonaKey ? (
                    <>
                      <Check className="text-accent size-4 shrink-0" aria-hidden />
                      <span className="sr-only">Current persona</span>
                    </>
                  ) : null}
                </DropdownMenuItem>
              ))}
            </>
          ) : (
            <>
              <DropdownMenuLabel>
                <span className="flex flex-col gap-1">
                  <span className="break-words">{identity.name}</span>
                  <span className="text-text-muted text-xs font-normal">Role: {roleLabel}</span>
                  <span className="text-text-subtle text-xs font-normal break-all">
                    {isDemo ? 'Development persona' : identity.email}
                  </span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="py-2">
                <span className="text-text-muted block text-xs font-normal">Current workspace</span>
                <span className="text-text mt-1 block text-sm font-semibold break-words">
                  {workspace.companyName}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="bg-accent-subtle text-accent rounded-sm px-1.5 py-0.5 font-semibold">
                    {workspace.accountType}
                  </span>
                  <span className="text-text-muted font-normal">{workspace.workspaceLabel}</span>
                </span>
              </DropdownMenuLabel>
              {isDemo ? (
                <DropdownMenuItem
                  ref={personaSwitchRef}
                  onSelect={(event) => {
                    event.preventDefault();
                    setShowPersonas(true);
                  }}
                >
                  <Building2 className="text-text-muted size-4" aria-hidden />
                  Switch development persona
                  <ChevronRight className="text-text-muted ml-auto size-4" aria-hidden />
                </DropdownMenuItem>
              ) : canSwitchWorkspace ? (
                <DropdownMenuItem asChild>
                  <Link href="/select-organization">
                    <Building2 className="text-text-muted size-4" aria-hidden />
                    Switch workspace
                    <ChevronRight className="text-text-muted ml-auto size-4" aria-hidden />
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <Link href={homeHref}>
                  <House className="text-text-muted size-4" aria-hidden />
                  Workspace home
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  toggleTheme();
                }}
              >
                {theme === 'light' ? (
                  <Moon className="size-4" aria-hidden />
                ) : (
                  <Sun className="size-4" aria-hidden />
                )}
                {theme === 'light' ? 'Dark theme' : 'Light theme'}
              </DropdownMenuItem>
              {!isDemo ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={pending}
                    onSelect={(event) => {
                      event.preventDefault();
                      void signOut();
                    }}
                  >
                    <LogOut className="size-4" aria-hidden />
                    {pending ? 'Signing out…' : 'Sign out'}
                  </DropdownMenuItem>
                </>
              ) : null}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? (
        <p role="alert" className="text-zone-red px-2 py-1 text-xs">
          Sign out failed. Please retry.
        </p>
      ) : null}
    </>
  );
}
