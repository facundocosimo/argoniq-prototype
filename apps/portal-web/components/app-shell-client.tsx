'use client';

import { type JSX, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import Link from 'next/link';
import { type Role, roleSpaceOf } from '@argoniq/core-domain';
import { type SessionChrome } from '../lib/trpc/context.js';
import { AppShell, type NavGroup, type NavItem, ToastViewport } from '@argoniq/ui';
import { workspaceHome, workspaceNav, PLATFORM_NAV } from '../lib/navigation.js';
import { routes } from '../lib/routes.js';
import { WorkspaceAccessProvider, useWorkspaceAbility } from '../lib/workspace-access.js';
import { useRecentRecords } from '../lib/recent-records.js';
import { PageChromeProvider, PageTitleBar } from '../lib/page-chrome.js';
import { UserMenu } from './user-menu.js';
import { MachineTopbar } from './machine-topbar.js';
import { WorkspaceIdentity, type WorkspaceIdentityProps } from './workspace-identity.js';
import { ImpersonationBanner } from './impersonation-banner.js';
import { CommandDialog, CommandTrigger } from './command-dialog.js';

/**
 * Client wrapper around the one `AppShell`. It is principal-aware:
 * the platform operator gets the platform nav (manage Manufacturers), while OEM/
 * customer principals get the tenant nav filtered by role. When the platform
 * operator is impersonating a tenant, the tenant chrome renders WITH a persistent
 * impersonation banner. Page search uses the same authorized navigation as the shell.
 */
export type ShellSession = SessionChrome;

export type AppShellClientProps = {
  tenantName: string;
  session: ShellSession;
  activePersonaKey: string | null;
  children: ReactNode;
};

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  support_manager: 'Support manager',
  support_technician: 'Support technician',
  spare_parts: 'Spare parts',
  field_engineer: 'Field engineer',
  documentation: 'Documentation',
  site_admin: 'Site administrator',
  operator: 'Operator',
};

/**
 * The selected machine's id when the path is inside a machine workspace
 * (`/machines/{serial}/…` or the overview `/machines/{serial}`). `lines` is the
 * line-schematic sub-route, not a serial, so it stays at the global level.
 */
function machineIdFromPath(pathname: string): string | undefined {
  const match = /^\/machines\/([^/]+)(?:\/|$)/.exec(pathname);
  const id = match?.[1];
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : undefined;
}

/**
 * Match the active nav item by longest href prefix of the current path, recursing into
 * children; on an equal-length tie the deeper (child) item wins, so a sub-item highlights
 * over its parent when they share the section root (e.g. `/manage/documents`).
 */
function activeKeyFor(nav: NavGroup[], pathname: string): string | undefined {
  let best: { key: string; length: number; depth: number } | undefined;
  const consider = (item: NavItem, depth: number): void => {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (
      matches &&
      (!best ||
        item.href.length > best.length ||
        (item.href.length === best.length && depth > best.depth))
    ) {
      best = { key: item.key, length: item.href.length, depth };
    }
    item.children?.forEach((child) => consider(child, depth + 1));
  };
  for (const group of nav) for (const item of group.items) consider(item, 0);
  return best?.key;
}

export function AppShellClient(props: AppShellClientProps): JSX.Element {
  return (
    <PageChromeProvider>
      <WorkspaceAccessProvider actor={props.session.mode === 'tenant' ? props.session.actor : null}>
        <WorkspaceShell {...props} />
      </WorkspaceAccessProvider>
    </PageChromeProvider>
  );
}

function WorkspaceShell({
  tenantName,
  session,
  activePersonaKey,
  children,
}: AppShellClientProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();

  const isPlatform = session.mode === 'platform';
  // Category navigation stays stable inside machine records; record sections sit below it.
  const machineId = isPlatform ? undefined : machineIdFromPath(pathname);
  const ability = useWorkspaceAbility();
  const scope =
    session.mode === 'tenant'
      ? `${session.actor.userId}:${session.activeTenantId}:${session.role}:${session.actor.companyId ?? ''}`
      : `platform:${session.identity.email}`;
  const recent = useRecentRecords(scope);
  const nav = (isPlatform ? PLATFORM_NAV : workspaceNav(session.role, ability)).map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item, recent: recent[item.key] ?? [] })),
  }));
  // Platform items carry no tier/oem gates, so any role passes visibleNav; a real
  // role drives the tenant nav.
  const navRole: Role = isPlatform ? 'admin' : session.role;
  const isCustomer = session.mode === 'tenant' && roleSpaceOf(session.role) === 'customer';
  const companyName =
    isCustomer && session.mode === 'tenant'
      ? (session.companyName ?? 'Company unavailable')
      : tenantName;
  const roleLabel = isPlatform ? 'Platform operator' : ROLE_LABEL[session.role];
  const accountType = isPlatform ? 'Platform' : isCustomer ? 'Customer' : 'OEM';
  const workspaceLabel = isPlatform
    ? 'Administration'
    : isCustomer
      ? `Manufacturer: ${tenantName}`
      : session.role === 'admin'
        ? 'Administration'
        : 'Service';
  const workspace: WorkspaceIdentityProps = { companyName, accountType, workspaceLabel };
  const activeKey = activeKeyFor(
    nav,
    pathname
      .replace(/^\/manage\/machines/, '/machines')
      .replace(/^\/technical-information/, '/manage/documents'),
  );

  const handleNavigate = (item: NavItem): void => {
    router.push(item.href);
  };

  const impersonating = session.mode === 'tenant' ? session.impersonatingTenantName : null;
  // The account menu owns the principal's home link; the brand is static identity.
  const homeHref = isPlatform
    ? (PLATFORM_NAV[0]?.items[0]?.href ?? routes.machines)
    : workspaceHome(session.role);

  return (
    <>
      <AppShell
        tenantName={tenantName}
        preferenceScope={scope}
        role={navRole}
        nav={nav}
        onNavigate={handleNavigate}
        brandSlot={<WorkspaceIdentity {...workspace} />}
        topbarLeftSlot={machineId ? <MachineTopbar serialId={machineId} /> : null}
        sectionNav={
          machineId ? (
            <nav aria-label="Machine sections" className="flex flex-wrap gap-4">
              {[
                [routes.serial(machineId), 'Overview'],
                [routes.machineManuals(machineId), 'Manuals'],
                [routes.machineResolve(machineId), 'Ask a question'],
              ].map(([href, label]) => (
                <Link
                  key={href}
                  href={href!}
                  aria-current={pathname === href ? 'page' : undefined}
                  className="text-text-muted hover:border-border-strong hover:text-text aria-[current=page]:border-accent aria-[current=page]:text-accent inline-flex min-h-10 items-center border-b-2 border-transparent px-1 text-sm font-medium transition-colors [@media(pointer:coarse)]:min-h-11"
                >
                  {label}
                </Link>
              ))}
            </nav>
          ) : null
        }
        topbarActionsSlot={<CommandTrigger />}
        titleBar={machineId ? null : <PageTitleBar />}
        accountSlot={
          <UserMenu
            identity={session.identity}
            isDemo={session.isDemo}
            roleLabel={roleLabel}
            workspace={workspace}
            activePersonaKey={activePersonaKey}
            homeHref={homeHref}
            canSwitchWorkspace={!isPlatform}
          />
        }
        {...(activeKey !== undefined ? { activeKey } : {})}
      >
        {impersonating ? <ImpersonationBanner tenantName={impersonating} /> : null}
        {children}
      </AppShell>
      <CommandDialog role={navRole} nav={nav} />
      <ToastViewport />
    </>
  );
}
