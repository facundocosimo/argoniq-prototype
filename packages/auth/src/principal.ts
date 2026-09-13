import { type UserId } from '@argoniq/core-domain';
import { type Actor } from './actor.js';

/**
 * The request principal — "who is asking", one level up from `Actor`.
 *
 * The platform has THREE levels: the ArgonIQ **platform operator** (super-admin,
 * above all tenants), an **Manufacturer** (a machine builder), and a **customer**
 * (the OEM's end user). An `Actor` models the latter two — it is always
 * tenant-scoped. The platform operator is deliberately NOT an `Actor`: it is not
 * scoped to any tenant and never touches tenant data through the tenant-scoped
 * services. It gets its own `PlatformContext` (the only surface that reads the
 * un-RLS'd `tenants` table).
 *
 * Crucially, the platform operator reaches an OEM's portal by **impersonation**,
 * which mints a normal, fully RLS-scoped OEM-admin `Actor` for one chosen tenant —
 * NOT a cross-tenant bypass. So even the super-admin, once inside an OEM, is bound
 * by that OEM's Row-Level Security. The single privileged act ("enter tenant X") is
 * audited and surfaced as a banner via `impersonatedBy`.
 */
export interface PlatformPrincipal {
  readonly kind: 'platform';
  readonly userId: UserId;
}

export interface TenantPrincipal {
  readonly kind: 'tenant';
  readonly actor: Actor;
  /** Set when a platform operator is impersonating this tenant (audited + bannered). */
  readonly impersonatedBy?: UserId;
}

export type Principal = PlatformPrincipal | TenantPrincipal;

export function isPlatformPrincipal(principal: Principal): principal is PlatformPrincipal {
  return principal.kind === 'platform';
}

export function isImpersonating(principal: Principal): boolean {
  return principal.kind === 'tenant' && principal.impersonatedBy !== undefined;
}
