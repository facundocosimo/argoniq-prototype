'use client';

import { useState, type JSX, type ReactNode } from 'react';
import { type Role } from '@argoniq/core-domain';
import { cn } from '../../lib/cn.js';
import { CategoryNav } from './category-nav.js';
import { Footer, type FooterProps } from './footer.js';
import { visibleNav, type NavGroup, type NavItem } from './nav.js';
import { TablePreferenceScope } from '../data-table.js';

/** Shared compact category shell. Navigation remains stable inside records; the same
 * content reflows below it on phones. Feature code owns routes, permissions and state. */
export type AppShellProps = {
  /** Active workspace name. */
  tenantName: string;
  /** Static active organization identity. Workspace switching belongs in accountSlot. */
  brandSlot?: ReactNode;
  /** The signed-in actor's role — drives which nav items are visible. */
  role: Role;
  /** Full navigation model (filtered by role inside the shell). */
  nav: NavGroup[];
  activeKey?: string;
  onNavigate?: (item: NavItem) => void;

  /** Topbar slots. */
  topbarLeftSlot?: ReactNode;
  topbarActionsSlot?: ReactNode;
  /** Page identity and actions beneath the visually distinct global navigation. */
  titleBar?: ReactNode;
  /** Record sections appear in their own row below identity, with a quiet divider. */
  sectionNav?: ReactNode;
  /** Signed-in identity and account controls. */
  accountSlot?: ReactNode;

  footer?: FooterProps;
  children: ReactNode;
  className?: string;
  preferenceScope?: string;
};

export function AppShell({
  tenantName,
  brandSlot,
  role,
  nav,
  activeKey,
  onNavigate,
  topbarLeftSlot,
  topbarActionsSlot,
  titleBar,
  sectionNav,
  accountSlot,
  footer,
  children,
  className,
  preferenceScope = '',
}: AppShellProps): JSX.Element {
  const groups = visibleNav(nav, role);
  const [scrolled, setScrolled] = useState(false);

  return (
    <div className={cn('bg-canvas text-text flex h-dvh', className)}>
      {/* Content column. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Workspace/navigation first, then one compact page identity row. */}
        <header
          className={cn(
            'border-border bg-bg ease-out-fast shrink-0 border-b transition-shadow duration-150',
            scrolled && 'shadow-sm',
          )}
        >
          <div className="border-border bg-canvas grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 border-b px-3 py-2 sm:gap-x-4 sm:px-4 xl:grid-cols-[minmax(12rem,20rem)_minmax(0,1fr)_auto] xl:py-0">
            <div className="min-w-0">
              {brandSlot ?? <span className="font-semibold">{tenantName}</span>}
            </div>
            <div className="order-3 col-span-2 min-w-0 py-1 xl:order-none xl:col-span-1">
              <CategoryNav
                items={groups.flatMap((group) => group.items)}
                activeKey={activeKey}
                onNavigate={onNavigate}
              />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              {topbarActionsSlot}
              {accountSlot}
            </div>
          </div>
          {topbarLeftSlot ? (
            <div className="flex min-h-10 items-center px-4 sm:px-6 lg:px-8">{topbarLeftSlot}</div>
          ) : null}
          {titleBar}
          {sectionNav ? (
            <div className="border-border border-t px-4 sm:px-6 lg:px-8">{sectionNav}</div>
          ) : null}
        </header>
        <main
          onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 4)}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <TablePreferenceScope.Provider value={preferenceScope}>
            {children}
          </TablePreferenceScope.Provider>
        </main>
        {footer ? <Footer {...footer} /> : null}
      </div>
    </div>
  );
}
