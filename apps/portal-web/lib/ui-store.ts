'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Centralized ephemeral UI state (minimal Zustand, UI only). The one
 * store for chrome state: the desktop sidebar collapse (persisted across sessions),
 * the mobile nav drawer, and the command palette. Server state stays in TanStack
 * Query / RSC; this holds only view state that several components share, so we avoid
 * prop-drilling and duplicate `useState`.
 */
type UiState = {
  /** Desktop sidebar collapsed to an icon rail (persisted). */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  /** Mobile nav drawer open (ephemeral). */
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;

  /** Command palette open (ephemeral). */
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      drawerOpen: false,
      setDrawerOpen: (open) => set({ drawerOpen: open }),

      commandOpen: false,
      setCommandOpen: (open) => set({ commandOpen: open }),
    }),
    {
      name: 'mm-ui',
      // Persist only the durable preference; never the ephemeral open/closed flags.
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
