'use client';

import { type JSX, type ReactNode, useState } from 'react';
import { cn } from '../../lib/cn.js';
import { type NavGroup, type NavItem } from './nav.js';

/**
 * Sidebar. The full-height primary navigation: the white-label
 * brand at the top, grouped nav with quiet uppercase section headers, and an
 * optional footer slot (e.g. the user/env). Role-aware (the caller passes an
 * already-filtered nav via `visibleNav`). Collapsible to an icon rail on desktop;
 * presented as a drawer on mobile by AppShell. Active item = a soft accent-tinted
 * fill + accent text/icon (no pill). Keyboard-first with a real <nav> landmark.
 *
 * A nav item may carry `children`: it then renders as an expandable section (a chevron
 * toggle, auto-open when the item or a child is active) with indented sub-items — the
 * reusable alternative to in-page tabs. Children are hidden on the collapsed icon rail.
 */
export type SidebarProps = {
  /** White-label tenant/OEM brand name. */
  tenantName: string;
  /** Optional brand renderer (logo) replacing the default monogram + name.
   *  Receives the collapsed state so it can drop to a mark-only glyph on the rail. */
  brandSlot?: (collapsed: boolean) => ReactNode;
  groups: NavGroup[];
  /** The currently active item key (route-driven by the app). */
  activeKey?: string;
  /** Called when a nav item is chosen (the app performs navigation). */
  onNavigate?: (item: NavItem) => void;
  /** Collapsed = icon-rail only (desktop). Labels + section headers hidden. */
  collapsed?: boolean;
  /** Optional band between the brand and the nav (e.g. the machine-context header:
   *  a back link + the selected machine). Receives the collapsed state. */
  renderNavHeader?: (collapsed: boolean) => ReactNode;
  /** Content pinned to the bottom of the rail (e.g. a user card). Receives the
   *  collapsed state so it can render compactly on the icon rail. */
  renderFooter?: (collapsed: boolean) => ReactNode;
};

/** A rotating caret for an expandable section. Dependency-free (no icon import here). */
function Chevron({ open }: { open: boolean }): JSX.Element {
  return (
    <svg
      viewBox="0 0 12 12"
      className={cn('size-3 transition-transform duration-150', open && 'rotate-90')}
      aria-hidden
    >
      <path
        d="M4 2.5 L8 6 L4 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** One navigable row (leaf or the header of a section). `depth > 0` = an indented child. */
function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
  depth = 0,
  className,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: ((item: NavItem) => void) | undefined;
  depth?: number;
  className?: string | undefined;
}): JSX.Element {
  const Icon = item.icon;
  const hasBadge = typeof item.badge === 'number' && item.badge > 0;
  return (
    <a
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      onClick={
        onNavigate
          ? (event) => {
              event.preventDefault();
              onNavigate(item);
            }
          : undefined
      }
      className={cn(
        'group ease-out-fast flex items-center gap-2.5 rounded-md py-2 text-[0.8125rem] tracking-[-0.005em] transition-colors duration-150',
        'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
        depth > 0 ? 'pr-2.5 pl-9' : 'px-2.5',
        active
          ? 'bg-sidebar-active text-sidebar-active-text font-medium'
          : 'text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text',
        collapsed && 'justify-center px-0',
        className,
      )}
    >
      {Icon && depth === 0 ? (
        <Icon
          className={cn(
            'size-4 shrink-0 transition-colors',
            active
              ? 'text-sidebar-accent'
              : 'text-sidebar-text-subtle group-hover:text-sidebar-text',
          )}
          aria-hidden
        />
      ) : null}
      {depth > 0 && !collapsed ? (
        <span
          className={cn(
            'size-1 shrink-0 rounded-full',
            active ? 'bg-sidebar-accent' : 'bg-sidebar-text-subtle',
          )}
          aria-hidden
        />
      ) : null}
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {hasBadge ? (
            <span
              className={cn(
                'nums-tabular shrink-0 text-xs tabular-nums',
                active ? 'text-sidebar-accent' : 'text-sidebar-text-subtle',
              )}
            >
              {item.badge}
            </span>
          ) : null}
        </>
      ) : null}
    </a>
  );
}

/** A top-level row: a plain link, or an expandable section when it has children. */
function NavRow({
  item,
  activeKey,
  collapsed,
  onNavigate,
  open,
  onToggle,
  onOpen,
}: {
  item: NavItem;
  activeKey?: string | undefined;
  collapsed: boolean;
  onNavigate?: ((item: NavItem) => void) | undefined;
  open: boolean;
  onToggle: () => void;
  /** Force the section open (called when the parent itself is navigated to). */
  onOpen: () => void;
}): JSX.Element {
  const active = item.key === activeKey;
  const children = item.children ?? [];
  // On the collapsed rail there is no room for a sub-tree — render just the parent link.
  if (children.length === 0 || collapsed) {
    return (
      <li>
        <NavLink item={item} active={active} collapsed={collapsed} onNavigate={onNavigate} />
      </li>
    );
  }

  const Icon = item.icon;
  const hasBadge = typeof item.badge === 'number' && item.badge > 0;
  const childActive = children.some((c) => c.key === activeKey);

  // The parent renders as one integrated row that shares a single hover/active fill:
  // the label is a real link that navigates AND self-expands the sub-tree; the caret,
  // flush at the right edge, is the manual expand/collapse toggle (never navigates).
  return (
    <li>
      <div
        className={cn(
          'group ease-out-fast flex items-stretch rounded-md transition-colors duration-150',
          active || childActive
            ? 'bg-sidebar-active text-sidebar-active-text'
            : 'text-sidebar-text-muted hover:bg-sidebar-hover',
        )}
      >
        <a
          href={item.href}
          aria-current={active ? 'page' : undefined}
          onClick={(event) => {
            // Self-show children on click, then let the app perform client navigation.
            onOpen();
            if (onNavigate) {
              event.preventDefault();
              onNavigate(item);
            }
          }}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2.5 rounded-l-md py-2 pl-2.5 text-[0.8125rem] tracking-[-0.005em]',
            'focus-visible:outline-focus focus-visible:outline-2 focus-visible:-outline-offset-2',
            active ? 'font-medium' : 'group-hover:text-sidebar-text',
          )}
        >
          {Icon ? (
            <Icon
              className={cn(
                'size-4 shrink-0 transition-colors',
                active
                  ? 'text-sidebar-accent'
                  : 'text-sidebar-text-subtle group-hover:text-sidebar-text',
              )}
              aria-hidden
            />
          ) : null}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {hasBadge ? (
            <span
              className={cn(
                'nums-tabular shrink-0 text-xs tabular-nums',
                active ? 'text-sidebar-accent' : 'text-sidebar-text-subtle',
              )}
            >
              {item.badge}
            </span>
          ) : null}
        </a>
        <button
          type="button"
          aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
          aria-expanded={open}
          onClick={onToggle}
          className={cn(
            'flex shrink-0 items-center rounded-r-md py-2 pr-2.5 pl-1.5 transition-colors',
            'focus-visible:outline-focus focus-visible:outline-2 focus-visible:-outline-offset-2',
            active || childActive
              ? 'text-sidebar-accent'
              : 'text-sidebar-text-subtle group-hover:text-sidebar-text',
          )}
        >
          <Chevron open={open} />
        </button>
      </div>
      {open ? (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {children.map((child) => (
            <li key={child.key}>
              <NavLink
                item={child}
                active={child.key === activeKey}
                collapsed={collapsed}
                onNavigate={onNavigate}
                depth={1}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function Sidebar({
  tenantName,
  brandSlot,
  groups,
  activeKey,
  onNavigate,
  collapsed = false,
  renderNavHeader,
  renderFooter,
}: SidebarProps): JSX.Element {
  // Manual expand/collapse overrides; absent → the section auto-opens when active.
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({});
  const sectionOpen = (item: NavItem): boolean => {
    const childActive = item.children?.some((c) => c.key === activeKey) ?? false;
    return openOverride[item.key] ?? (item.key === activeKey || childActive);
  };

  return (
    <div className="bg-sidebar text-sidebar-text flex h-full flex-col">
      {/* Brand / workspace switcher — aligned to the content topbar height. */}
      <div
        className={cn(
          'h-topbar border-sidebar-border flex shrink-0 items-center gap-2 border-b px-2',
          collapsed && 'justify-center px-0',
        )}
      >
        {brandSlot ? (
          brandSlot(collapsed)
        ) : (
          <>
            <span
              aria-hidden
              className="bg-brand text-accent-contrast flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold shadow-xs"
            >
              {tenantName.charAt(0).toUpperCase()}
            </span>
            {!collapsed ? (
              <span className="text-sidebar-text truncate text-sm font-semibold tracking-tight">
                {tenantName}
              </span>
            ) : null}
          </>
        )}
      </div>

      {/* Context band (e.g. the selected machine) — sits between brand and nav. */}
      {renderNavHeader ? (
        <div className="border-sidebar-border shrink-0 border-b px-3 py-2.5">
          {renderNavHeader(collapsed)}
        </div>
      ) : null}

      {/* Nav */}
      <nav
        aria-label="Primary"
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 py-5"
      >
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-1.5">
            {group.label && !collapsed ? (
              <p className="text-sidebar-text-subtle px-2 pb-0.5 text-[0.6875rem] font-semibold tracking-[0.12em] uppercase">
                {group.label}
              </p>
            ) : null}
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => (
                <NavRow
                  key={item.key}
                  item={item}
                  activeKey={activeKey}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  open={sectionOpen(item)}
                  onToggle={() =>
                    setOpenOverride((prev) => ({ ...prev, [item.key]: !sectionOpen(item) }))
                  }
                  onOpen={() => setOpenOverride((prev) => ({ ...prev, [item.key]: true }))}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {renderFooter ? (
        <div className="border-sidebar-border shrink-0 border-t p-2.5">
          {renderFooter(collapsed)}
        </div>
      ) : null}
    </div>
  );
}
