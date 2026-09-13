'use client';

import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type JSX,
  type MouseEvent,
  type KeyboardEvent,
} from 'react';
import { ChevronDown, Clock3, List, Plus } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { type NavItem } from './nav.js';

/** Navigation disclosure, not an application menu: links retain native Tab behavior.
 * Hover never moves focus; the chevron supports click, arrows and Escape. */
export function CategoryNav({
  items,
  activeKey,
  onNavigate,
}: {
  items: NavItem[];
  activeKey?: string | undefined;
  onNavigate?: ((item: NavItem) => void) | undefined;
}): JSX.Element {
  const [openKey, setOpenKey] = useState<string | null>(null);
  return (
    <nav aria-label="Main navigation" className="flex min-w-0 flex-wrap items-center gap-1">
      {items.map((item) => (
        <Category
          key={item.key}
          item={item}
          activeKey={activeKey}
          onNavigate={onNavigate}
          open={openKey === item.key}
          setOpen={(value) =>
            setOpenKey((current) => (value ? item.key : current === item.key ? null : current))
          }
        />
      ))}
    </nav>
  );
}

function Category({
  item,
  activeKey,
  onNavigate,
  open,
  setOpen,
}: {
  item: NavItem;
  activeKey?: string | undefined;
  onNavigate?: ((item: NavItem) => void) | undefined;
  open: boolean;
  setOpen: (value: boolean) => void;
}): JSX.Element {
  const [left, setLeft] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const panelId = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const position = (): void => {
      const rect = root.current?.getBoundingClientRect();
      if (rect)
        setLeft(
          Math.min(0, window.innerWidth - 16 - rect.left - Math.min(240, window.innerWidth - 32)),
        );
    };
    position();
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [open, setOpen]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event): void => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [open, setOpen]);
  const navigate = (event: MouseEvent<HTMLAnchorElement>, target: NavItem): void => {
    if (
      !onNavigate ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    setOpen(false);
    onNavigate(target);
  };
  const focusLink = (last = false): void => {
    requestAnimationFrame(() => {
      const links = panel.current?.querySelectorAll<HTMLAnchorElement>('a[href]');
      links?.[last ? links.length - 1 : 0]?.focus();
    });
  };
  const panelKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    const links = Array.from(panel.current?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? []);
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next =
      event.key === 'ArrowDown'
        ? (index + 1) % links.length
        : event.key === 'ArrowUp'
          ? (index - 1 + links.length) % links.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? links.length - 1
              : undefined;
    if (next !== undefined) {
      event.preventDefault();
      links[next]?.focus();
    }
  };
  const active = item.key === activeKey || item.children?.some((child) => child.key === activeKey);
  const Icon = item.icon;
  const entry = (target: NavItem): JSX.Element => (
    <a
      key={target.key}
      href={target.href}
      onClick={(event) => navigate(event, target)}
      className="text-text hover:bg-surface focus-visible:bg-surface focus-visible:outline-focus flex min-h-11 items-center gap-2 rounded-sm px-3 py-2 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 sm:min-h-9 [@media(pointer:coarse)]:min-h-11"
    >
      {target.icon ? <target.icon className="text-text-muted size-4 shrink-0" aria-hidden /> : null}
      <span className="truncate">{target.label}</span>
    </a>
  );
  /* The wrapper coordinates pointer intent and Escape across its native link/button children. */
  /* eslint-disable jsx-a11y/no-static-element-interactions */
  return (
    <div
      ref={root}
      className="relative shrink-0"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') {
          clearTimeout(timer.current);
          setOpen(true);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse')
          timer.current = setTimeout(() => {
            if (!root.current?.contains(document.activeElement)) setOpen(false);
          }, 180);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <div
        className={cn(
          'hover:bg-surface flex items-center rounded-md transition-colors',
          active && 'bg-accent-subtle text-accent',
        )}
      >
        <a
          href={item.href}
          onClick={(event) => navigate(event, item)}
          aria-current={active ? 'page' : undefined}
          className="focus-visible:outline-focus flex min-h-11 items-center gap-2 rounded-l-md px-2.5 text-sm font-medium focus-visible:outline-2 sm:min-h-9 [@media(pointer:coarse)]:min-h-11"
        >
          {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
          {item.label}
        </a>
        <button
          ref={trigger}
          type="button"
          aria-label={`${item.label} menu`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              focusLink(event.key === 'ArrowUp');
            }
          }}
          className="hover:bg-accent-subtle focus-visible:outline-focus flex min-h-11 w-8 items-center justify-center rounded-r-md focus-visible:outline-2 sm:min-h-9 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:w-11"
        >
          <ChevronDown
            className={cn('size-3.5 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </button>
      </div>
      {open ? (
        <div
          id={panelId}
          ref={panel}
          style={{ left }}
          onKeyDown={panelKey}
          aria-label={`${item.label} shortcuts`}
          className="border-border bg-bg absolute top-full left-0 z-50 max-h-[65dvh] w-60 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border p-1 shadow-md"
        >
          {entry({
            ...item,
            key: `${item.key}-list`,
            label: `All ${item.label.toLowerCase()}`,
            icon: List,
          })}
          {item.children?.map(entry)}
          <div className="border-border my-1 border-t" />
          <p className="text-text-muted flex items-center gap-2 px-3 py-2 text-xs font-medium">
            <Clock3 className="size-3.5" aria-hidden />
            Recently viewed
          </p>
          {item.recent?.length ? (
            item.recent.slice(0, 5).map(entry)
          ) : (
            <p className="text-text-muted px-3 py-2 text-xs">Records you open appear here.</p>
          )}
          {item.create ? (
            <>
              <div className="border-border my-1 border-t" />
              {entry({ ...item.create, icon: Plus })}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
  /* eslint-enable jsx-a11y/no-static-element-interactions */
}
