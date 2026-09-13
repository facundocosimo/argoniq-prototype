'use client';

import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, ChevronDown, Loader2, Plus, Search } from 'lucide-react';
import { cn } from '../lib/cn.js';

/**
 * Combobox  — the one searchable single-select. A tokenized trigger
 * (matches `Input`/`Select`) opens a Radix Popover hosting a filter box + a listbox of
 * rich options. Every picker in the app uses this: search-first, optional inline
 * "create new", and a customizable per-option display (a leading node + a two-line
 * label/description, e.g. a site shown as name over its country with a flag). Built on
 * Popover, not DropdownMenu, because a menu steals keystrokes for typeahead — a combo
 * needs its own text input. Fully keyboard-driven and ARIA-correct.
 */

export type ComboboxOption = {
  value: string;
  /** Primary line; the default search target and the trigger's display text. */
  label: string;
  /** Optional secondary line under the label (e.g. a site's country). */
  description?: string | undefined;
  /** Optional leading node — a flag, avatar, or icon. */
  leading?: ReactNode | undefined;
  /** Extra search terms beyond label + description. */
  keywords?: readonly string[] | undefined;
  disabled?: boolean | undefined;
};

export type ComboboxProps = {
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: readonly ComboboxOption[];
  /** Trigger text when nothing is selected. */
  placeholder?: string | undefined;
  /** Filter-box placeholder. */
  searchPlaceholder?: string | undefined;
  /** Shown when the filter matches nothing (and no create is offered). */
  emptyText?: string | undefined;
  disabled?: boolean | undefined;
  invalid?: boolean | undefined;
  /** Options are still being fetched — shows a loading row instead of the empty state. */
  loading?: boolean | undefined;
  /** Offer "Create …" when the typed query matches no option. Receives the trimmed query. */
  onCreate?: ((query: string) => void) | undefined;
  /** Label for the create row; defaults to `Create "<query>"`. */
  createLabel?: ((query: string) => string) | undefined;
  /** Whether the create row is busy (e.g. the create mutation is pending). */
  creating?: boolean | undefined;
  /** Hide the filter box for tiny lists — still fully keyboard-navigable. Default: true. */
  searchable?: boolean | undefined;
  id?: string | undefined;
  name?: string | undefined;
  onBlur?: (() => void) | undefined;
  className?: string | undefined;
  'aria-label'?: string | undefined;
  'aria-labelledby'?: string | undefined;
  'aria-describedby'?: string | undefined;
};

function matches(option: ComboboxOption, q: string): boolean {
  if (!q) return true;
  const hay = [option.label, option.description ?? '', ...(option.keywords ?? [])]
    .join(' ')
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((term) => hay.includes(term));
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches.',
  disabled = false,
  invalid = false,
  loading = false,
  onCreate,
  createLabel = (q) => (q ? `Create “${q}”` : 'Create new'),
  creating = false,
  searchable = true,
  id,
  name,
  onBlur,
  className,
  ...aria
}: ComboboxProps): ReactNode {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);
  const filtered = useMemo(() => options.filter((o) => matches(o, query.trim())), [options, query]);

  const trimmed = query.trim();
  const showCreate =
    Boolean(onCreate) &&
    !loading &&
    trimmed.length > 0 &&
    !options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());
  const rowCount = filtered.length + (showCreate ? 1 : 0);

  const close = (): void => {
    setOpen(false);
    setQuery('');
  };

  const choose = (index: number): void => {
    if (showCreate && index === filtered.length) {
      onCreate?.(trimmed);
      close();
      return;
    }
    const option = filtered[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (rowCount === 0 ? 0 : (i + 1) % rowCount));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (rowCount === 0 ? 0 : (i - 1 + rowCount) % rowCount));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(Math.max(0, rowCount - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(active);
    }
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery('');
          const i = selected
            ? Math.max(0, options.filter((o) => matches(o, '')).indexOf(selected))
            : 0;
          setActive(i);
        } else {
          onBlur?.();
        }
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          name={name}
          disabled={disabled}
          data-invalid={invalid || undefined}
          aria-label={aria['aria-label']}
          aria-labelledby={aria['aria-labelledby']}
          aria-describedby={aria['aria-describedby']}
          className={cn(
            'border-border bg-bg text-text flex h-11 w-full items-center gap-2 rounded-md border px-3 text-base sm:h-9 sm:text-sm',
            'ease-out-fast hover:border-border-strong transition-colors duration-150',
            'focus-visible:border-accent focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'data-[state=open]:border-accent',
            invalid && 'border-danger',
            className,
          )}
        >
          {selected?.leading ? (
            <span className="flex shrink-0 items-center">{selected.leading}</span>
          ) : null}
          <span
            className={cn('min-w-0 flex-1 truncate text-left', !selected && 'text-text-subtle')}
          >
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="text-text-subtle size-4 shrink-0" aria-hidden />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(event) => {
            if (searchable) {
              event.preventDefault();
              inputRef.current?.focus();
            }
          }}
          className="mm-animate-menu border-border bg-bg z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border p-1 shadow-md"
        >
          {searchable ? (
            <div className="border-border flex items-center gap-2 border-b px-2 pt-1 pb-1.5">
              <Search className="text-text-subtle size-4 shrink-0" aria-hidden />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={rowCount > 0 ? `${listId}-${active}` : undefined}
                value={query}
                placeholder={searchPlaceholder}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                className="text-text placeholder:text-text-subtle h-7 w-full bg-transparent text-sm outline-none"
              />
            </div>
          ) : null}

          <div id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === active;
              return (
                <button
                  key={option.value}
                  id={`${listId}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onClick={() => choose(index)}
                  onMouseMove={() => setActive(index)}
                  className={cn(
                    'text-text flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm outline-none',
                    'disabled:pointer-events-none disabled:opacity-50',
                    isActive && 'bg-surface',
                  )}
                >
                  {option.leading ? (
                    <span className="flex shrink-0 items-center">{option.leading}</span>
                  ) : null}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.description ? (
                      <span className="text-text-subtle truncate text-xs">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {isSelected ? (
                    <Check className="text-accent size-4 shrink-0" aria-hidden />
                  ) : null}
                </button>
              );
            })}

            {showCreate ? (
              <button
                id={`${listId}-${filtered.length}`}
                type="button"
                role="option"
                aria-selected={false}
                disabled={creating}
                onClick={() => choose(filtered.length)}
                onMouseMove={() => setActive(filtered.length)}
                className={cn(
                  'text-accent flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm outline-none disabled:opacity-60',
                  active === filtered.length && 'bg-surface',
                )}
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {creating ? 'Creating…' : createLabel(trimmed)}
                </span>
              </button>
            ) : null}

            {loading && rowCount === 0 ? (
              <p className="text-text-subtle flex items-center justify-center gap-2 px-2 py-3 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading…
              </p>
            ) : rowCount === 0 ? (
              <p className="text-text-subtle px-2 py-3 text-center text-sm">{emptyText}</p>
            ) : null}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
