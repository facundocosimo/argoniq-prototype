import { cookies, headers } from 'next/headers';
import { type Actor, Actor as ActorSchema, type Principal } from '@argoniq/auth';
import { createPlatformContext, createServiceContext } from '@argoniq/core';
import { type TRPCContext } from '@argoniq/core/trpc';
import { type Role, TenantId, UserId } from '@argoniq/core-domain';
import { getEnv } from '@argoniq/core-domain/env';
import { getIdentityUser, getMembershipCompany } from '@argoniq/db';
import { auth } from '../auth.js';
import {
  activeMemberships,
  membershipsForUser,
  principalForMembership,
  resolveSelectedMembership,
} from '../authz.js';
import {
  DEFAULT_PERSONA_KEY,
  PLATFORM_USER_ID,
  type PersonaPrincipalSpec,
  getPersona,
} from '../demo/personas.js';

/** The selected organization is a convenience, never proof of authorization. */
export const ACTIVE_TENANT_COOKIE = 'argoniq_active_tenant';
export const PERSONA_COOKIE = 'argoniq_persona';
export const IMPERSONATE_COOKIE = 'argoniq_impersonate';
export const IMPERSONATE_NAME_COOKIE = 'argoniq_impersonate_name';

export type SessionIdentity = { readonly name: string; readonly email: string };
export type OrganizationChoice = { readonly tenantId: string; readonly name: string };

export type SessionChrome =
  | {
      readonly mode: 'platform';
      readonly identity: SessionIdentity;
      readonly isDemo: boolean;
      readonly tenantName: string;
    }
  | {
      readonly mode: 'tenant';
      readonly actor: Actor;
      readonly companyName: string | null;
      readonly identity: SessionIdentity;
      readonly isDemo: boolean;
      readonly tenantName: string;
      readonly role: Role;
      readonly impersonatingTenantName: string | null;
      readonly organizations: readonly OrganizationChoice[];
      readonly activeTenantId: string;
    };

export type IdentityState =
  | { readonly kind: 'unauthenticated' }
  | { readonly kind: 'no-access'; readonly identity: SessionIdentity }
  | {
      readonly kind: 'select-organization';
      readonly identity: SessionIdentity;
      readonly organizations: readonly OrganizationChoice[];
    }
  | { readonly kind: 'resolved'; readonly principal: Principal; readonly chrome: SessionChrome };

function tenantActor(spec: Extract<PersonaPrincipalSpec, { kind: 'tenant' }>): Actor {
  return ActorSchema.parse({
    userId: spec.userId,
    tenantId: spec.tenantId,
    role: spec.role,
    ...(spec.companyId ? { companyId: spec.companyId } : {}),
  });
}

function demoIdentity(key: string): SessionIdentity {
  const persona = getPersona(key);
  return { name: persona.roleLabel, email: `${persona.key}@demo.argoniq.invalid` };
}

/** Development personas require an explicit opt-in and are impossible in production. */
async function resolveDemoState(): Promise<IdentityState | null> {
  const env = getEnv();
  if (env.NODE_ENV === 'production' || !env.DEMO_AUTH_ENABLED) return null;

  const jar = await cookies();
  const key = jar.get(PERSONA_COOKIE)?.value ?? DEFAULT_PERSONA_KEY;
  const persona = getPersona(key);
  const identity = demoIdentity(persona.key);

  if (persona.principal.kind === 'platform') {
    const target = jar.get(IMPERSONATE_COOKIE)?.value;
    if (target && TenantId.safeParse(target).success) {
      const tenantName = jar.get(IMPERSONATE_NAME_COOKIE)?.value ?? 'a manufacturer';
      const actor = ActorSchema.parse({
        userId: PLATFORM_USER_ID,
        tenantId: target,
        role: 'admin',
      });
      return {
        kind: 'resolved',
        principal: { kind: 'tenant', actor, impersonatedBy: UserId.parse(PLATFORM_USER_ID) },
        chrome: {
          mode: 'tenant',
          actor,
          companyName: null,
          identity,
          isDemo: true,
          tenantName,
          role: actor.role,
          impersonatingTenantName: tenantName,
          organizations: [{ tenantId: target, name: tenantName }],
          activeTenantId: target,
        },
      };
    }
    return {
      kind: 'resolved',
      principal: { kind: 'platform', userId: UserId.parse(PLATFORM_USER_ID) },
      chrome: { mode: 'platform', identity, isDemo: true, tenantName: 'ArgonIQ Platform' },
    };
  }

  const actor = tenantActor(persona.principal);
  const tenantName = persona.group.replace(' (OEM)', '');
  const company = actor.companyId
    ? await getMembershipCompany(actor.tenantId, actor.companyId)
    : null;
  return {
    kind: 'resolved',
    principal: { kind: 'tenant', actor },
    chrome: {
      mode: 'tenant',
      actor,
      companyName: company?.name ?? null,
      identity,
      isDemo: true,
      tenantName,
      role: actor.role,
      impersonatingTenantName: null,
      organizations: [{ tenantId: actor.tenantId, name: tenantName }],
      activeTenantId: actor.tenantId,
    },
  };
}

/**
 * Resolve a verified provider session into a current, DB-backed authorization
 * state. Membership is re-read on every request, so a revoked or suspended person
 * loses access without waiting for session expiry.
 */
async function resolveRealIdentityState(): Promise<IdentityState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { kind: 'unauthenticated' };

  const userId = UserId.safeParse(session.user.id);
  if (!userId.success) return { kind: 'unauthenticated' };
  const user = await getIdentityUser(userId.data);
  if (!user) return { kind: 'unauthenticated' };

  const identity = { name: session.user.name, email: session.user.email };
  if (user.isPlatformOperator) {
    return {
      kind: 'resolved',
      principal: { kind: 'platform', userId: userId.data },
      chrome: { mode: 'platform', identity, isDemo: false, tenantName: 'ArgonIQ Platform' },
    };
  }

  const memberships = activeMemberships(await membershipsForUser(userId.data));
  const organizations = memberships.map(({ tenantId, tenantName }) => ({
    tenantId,
    name: tenantName,
  }));
  if (memberships.length === 0) return { kind: 'no-access', identity };
  const selected = resolveSelectedMembership(
    memberships,
    (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value,
  );
  if (!selected) return { kind: 'select-organization', identity, organizations };

  const principal = principalForMembership(userId.data, selected);
  const actor = principal.actor;
  return {
    kind: 'resolved',
    principal,
    chrome: {
      mode: 'tenant',
      actor,
      companyName: selected.companyName,
      identity,
      isDemo: false,
      tenantName: selected.tenantName,
      role: selected.role,
      impersonatingTenantName: null,
      organizations,
      activeTenantId: selected.tenantId,
    },
  };
}

export async function currentIdentityState(): Promise<IdentityState> {
  const real = await resolveRealIdentityState();
  if (real.kind !== 'unauthenticated') return real;
  return (await resolveDemoState()) ?? real;
}

/** Build the per-request tRPC context — tenant service OR platform context, never both. */
export async function createTRPCContext(): Promise<TRPCContext> {
  const state = await currentIdentityState();
  if (state.kind !== 'resolved') return { service: null, platform: null };
  if (state.principal.kind === 'platform')
    return { service: null, platform: createPlatformContext({ principal: state.principal }) };
  return { service: createServiceContext({ actor: state.principal.actor }), platform: null };
}

export async function resolveRequestPrincipal(): Promise<Principal | null> {
  const state = await currentIdentityState();
  return state.kind === 'resolved' ? state.principal : null;
}

export async function currentPrincipal(): Promise<Principal | null> {
  return resolveRequestPrincipal();
}

export async function currentActor(): Promise<Actor | null> {
  const principal = await resolveRequestPrincipal();
  return principal?.kind === 'tenant' ? principal.actor : null;
}

/** Null for real sessions; demo controls consume this only when explicitly enabled. */
export async function currentPersonaKey(): Promise<string | null> {
  const env = getEnv();
  if (env.NODE_ENV === 'production' || !env.DEMO_AUTH_ENABLED) return null;
  const real = await resolveRealIdentityState();
  if (real.kind !== 'unauthenticated') return null;
  return (await cookies()).get(PERSONA_COOKIE)?.value ?? DEFAULT_PERSONA_KEY;
}

/** Null means the visitor must authenticate or choose an authorized organization. */
export async function resolveSessionChrome(): Promise<SessionChrome | null> {
  const state = await currentIdentityState();
  return state.kind === 'resolved' ? state.chrome : null;
}
