'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mm-theme';

/** Write the resolved theme to the DOM (drives the token set) and persist it. */
function commit(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage may be unavailable (private mode); the in-session toggle still works.
  }
}

type ThemeStore = {
  theme: Theme;
  hydrated: boolean;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  hydrate: () => void;
};

/**
 * One shared theme store. Every control that reflects or flips the
 * theme (the topbar toggle, the user-menu item) reads this single source, so they
 * never desync. `hydrate` runs once after mount to reconcile React state with the
 * `data-theme` the blocking head script already set (stored preference → system
 * preference → light), so there is no flash and no wrong initial glyph.
 */
const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'light',
  hydrated: false,
  setTheme: (theme) => {
    commit(theme);
    set({ theme });
  },
  toggle: () => get().setTheme(get().theme === 'light' ? 'dark' : 'light'),
  hydrate: () => {
    if (get().hydrated) return;
    const fromDom = document.documentElement.getAttribute('data-theme');
    const initial: Theme = fromDom === 'dark' || fromDom === 'light' ? fromDom : 'light';
    set({ theme: initial, hydrated: true });
  },
}));

export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useThemeStore((state) => state.theme);
  const toggle = useThemeStore((state) => state.toggle);
  const hydrate = useThemeStore((state) => state.hydrate);
  useEffect(() => hydrate(), [hydrate]);
  return { theme, toggle };
}

/**
 * Flip the theme with a circular reveal: the new theme wipes in as a circle expanding
 * from `origin` (the point the user clicked). Uses the View Transitions API to snapshot
 * the old UI and clip-reveal the new one on top — a single, physical gesture rather than
 * an abrupt repaint. Degrades gracefully: an instant swap when the API is unavailable or
 * the user prefers reduced motion. Callable from any control (topbar switch, user menu),
 * so every theme flip animates identically.
 */
export function toggleTheme(origin?: { x: number; y: number }): void {
  const run = (): void => useThemeStore.getState().toggle();

  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const doc =
    typeof document !== 'undefined'
      ? (document as Document & {
          startViewTransition?: (cb: () => void) => { ready: Promise<void> };
        })
      : undefined;

  if (reduced || !doc || typeof doc.startViewTransition !== 'function') {
    run();
    return;
  }

  // Reveal outward from the click; default to the top-right utility cluster.
  const x = origin?.x ?? window.innerWidth - 24;
  const y = origin?.y ?? 24;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  doc
    .startViewTransition(run)
    .ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`],
        },
        {
          duration: 520,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    })
    .catch(() => {
      // A transition can reject if interrupted (rapid re-toggles); the theme has already
      // flipped via `run`, so there is nothing to recover.
    });
}
