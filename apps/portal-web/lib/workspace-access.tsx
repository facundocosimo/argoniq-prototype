'use client';

import { createContext, useContext, useMemo, type ReactNode, type JSX } from 'react';
import type { Actor } from '@argoniq/auth';
import { defineAbilityFor, type AppAbility } from '@argoniq/auth/ability';

const Access = createContext<AppAbility | null>(null);
const Scope = createContext('');
/** Presentation uses the same policy rules; every service still authorizes its request. */
export function WorkspaceAccessProvider({
  actor,
  children,
}: {
  actor: Actor | null;
  children: ReactNode;
}): JSX.Element {
  const ability = useMemo(() => (actor ? defineAbilityFor(actor) : null), [actor]);
  const scope = actor
    ? `${actor.userId}:${actor.tenantId}:${actor.role}:${actor.companyId ?? ''}`
    : 'platform';
  return (
    <Access.Provider value={ability}>
      <Scope.Provider value={scope}>{children}</Scope.Provider>
    </Access.Provider>
  );
}
export function useWorkspaceAbility(): AppAbility | null {
  return useContext(Access);
}
export function useWorkspaceScope(): string {
  return useContext(Scope);
}
