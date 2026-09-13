'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { type Role } from '@argoniq/core-domain';
import { Dialog, DialogContent, DialogTitle, Kbd, visibleNav, type NavGroup } from '@argoniq/ui';
import { useUiStore } from '../lib/ui-store.js';

/**
 * Command palette  — ⌘K / topbar trigger opens a fast jump-to over the
 * shell's authorized navigation model. Searches page names, not database records.
 * Shared Dialog supplies focus containment, Escape and focus return.
 */
type CommandItem = { key: string; label: string; href: string; group: string };

export function CommandTrigger(): JSX.Element {
  const setOpen = useUiStore((state) => state.setCommandOpen);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Search pages"
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+K Control+K"
      className="text-text-muted hover:border-border-strong hover:bg-surface hover:text-text sm:border-border sm:bg-surface-subtle inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-sm whitespace-nowrap transition-colors sm:h-9 sm:w-48 sm:justify-start sm:px-3 [@media(pointer:coarse)]:h-11"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="hidden sm:inline">Search pages</span>
      <Kbd className="ml-auto hidden shrink-0 whitespace-nowrap sm:inline-flex" aria-hidden>
        ⌘ K
      </Kbd>
    </button>
  );
}

export function CommandDialog({ role, nav }: { role: Role; nav: NavGroup[] }): JSX.Element {
  const router = useRouter();
  const open = useUiStore((state) => state.commandOpen);
  const setOpen = useUiStore((state) => state.setCommandOpen);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLUListElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(!useUiStore.getState().commandOpen);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const items = useMemo<CommandItem[]>(
    () =>
      visibleNav(nav, role).flatMap((group) =>
        // Flatten sub-items (nav children) in alongside their parent so every
        // destination — e.g. the library's Coverage / Resolve lenses — is searchable.
        group.items.flatMap((item) =>
          [item, ...(item.children ?? []), ...(item.create ? [item.create] : [])].map((entry) => ({
            key: entry.key,
            label: entry.label,
            href: entry.href,
            group: group.label ?? '',
          })),
        ),
      ),
    [role, nav],
  );
  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((item) => item.label.toLowerCase().includes(q)) : items;

  function go(href: string): void {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  function moveResultFocus(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = Array.from(resultsRef.current?.querySelectorAll('button') ?? []);
    const index = buttons.indexOf(event.currentTarget);
    event.preventDefault();
    if (event.key === 'ArrowUp' && index <= 0) inputRef.current?.focus();
    else
      buttons[Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))]?.focus();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <DialogContent
        side="center"
        showClose={false}
        className="p-0"
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          inputRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
        }}
      >
        <div className="flex items-center justify-between px-4 pt-3">
          <DialogTitle className="text-sm font-medium">Search pages</DialogTitle>
          <button
            type="button"
            aria-label="Close search"
            onClick={() => {
              setOpen(false);
              setQuery('');
            }}
            className="text-text-muted hover:bg-surface flex size-11 items-center justify-center rounded-md sm:size-9 [@media(pointer:coarse)]:size-11"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="border-border flex items-center gap-2 border-b px-3">
          <Search className="text-text-subtle size-4 shrink-0" aria-hidden />
          {/* Search receives initial focus even though Close appears first in the DOM. */}
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                resultsRef.current?.querySelector('button')?.focus();
              }
              if (event.key === 'Enter' && filtered[0]) {
                event.preventDefault();
                go(filtered[0].href);
              }
            }}
            placeholder="Find a page…"
            aria-label="Search navigation"
            className="text-text placeholder:text-text-subtle h-11 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <ul ref={resultsRef} className="max-h-80 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <li className="text-text-muted px-3 py-6 text-center text-sm">No matches</li>
          ) : (
            filtered.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => go(item.href)}
                  onKeyDown={moveResultFocus}
                  className="text-text ease-out-fast hover:bg-surface focus-visible:bg-surface flex min-h-11 w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm transition-colors duration-150 focus-visible:outline-none"
                >
                  <span>{item.label}</span>
                  {item.group ? (
                    <span className="text-text-subtle ml-auto text-xs">{item.group}</span>
                  ) : null}
                  <ArrowUpRight className="text-text-muted size-3.5 shrink-0" aria-hidden />
                </button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
