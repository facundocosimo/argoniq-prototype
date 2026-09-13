'use client';

import { type JSX, type ReactNode } from 'react';
import { ChevronsLeft, ChevronsRight, Menu } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { IconButton } from '../../primitives/icon-button.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../primitives/tooltip.js';

/**
 * Topbar — row 1 of the integrated header band (the border + scroll shadow live on
 * the band wrapper in AppShell, not here). Left: the mobile drawer trigger + the
 * desktop collapse toggle, then the breadcrumb slot. Right: the page action toolbar
 * (machine workspace only) + command search + theme.
 */
export type TopbarProps = {
  leftSlot?: ReactNode;
  actionsSlot?: ReactNode;
  onToggleSidebar?: () => void;
  onOpenDrawer?: () => void;
  /** Desktop rail state — drives the collapse toggle's direction + label. */
  collapsed?: boolean;
};

export function Topbar({
  leftSlot,
  actionsSlot,
  onToggleSidebar,
  onOpenDrawer,
  collapsed = false,
}: TopbarProps): JSX.Element {
  return (
    <div className={cn('h-topbar flex shrink-0 items-center gap-2 px-3 sm:px-4')}>
      <IconButton
        size="touch"
        onClick={onOpenDrawer}
        aria-label="Open navigation menu"
        className="md:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </IconButton>

      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            onClick={onToggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:inline-flex"
          >
            {collapsed ? (
              <ChevronsRight className="size-4" aria-hidden />
            ) : (
              <ChevronsLeft className="size-4" aria-hidden />
            )}
          </IconButton>
        </TooltipTrigger>
        <TooltipContent>{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</TooltipContent>
      </Tooltip>

      {leftSlot ? <div className="flex min-w-0 items-center">{leftSlot}</div> : null}

      <div className="ml-auto flex items-center gap-1.5">{actionsSlot}</div>
    </div>
  );
}
