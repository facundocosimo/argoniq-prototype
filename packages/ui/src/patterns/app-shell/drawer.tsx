'use client';

import { type JSX, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '../../primitives/dialog.js';
import { IconButton } from '../../primitives/icon-button.js';

/**
 * NavDrawer. On mobile the sidebar collapses to a left sheet. It
 * composes the shared `Dialog` primitive (`side="left"`) so focus-trap, escape, and
 * scroll-lock are inherited, and renders the same Sidebar content inside (brand +
 * nav + footer). A floating close affordance meets the 44px touch target.
 */
export type NavDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function NavDrawer({ open, onOpenChange, children }: NavDrawerProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        side="left"
        showClose={false}
        overlayClassName="md:hidden"
        className="bg-sidebar md:hidden"
      >
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        <DialogClose asChild>
          <IconButton
            size="touch"
            aria-label="Close navigation menu"
            className="text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text absolute top-2 right-2 z-10"
          >
            <X className="size-5" aria-hidden />
          </IconButton>
        </DialogClose>
        {children}
      </DialogContent>
    </Dialog>
  );
}
