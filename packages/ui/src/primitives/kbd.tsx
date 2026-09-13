import { type HTMLAttributes, type JSX } from 'react';
import { cn } from '../lib/cn.js';

/**
 * Kbd  — a keyboard key hint (e.g. ⌘K). Quiet, monospace-free (uses
 * the UI sans so it sits flush in chrome), small radius, token-driven. Centralized so
 * every shortcut hint reads identically.
 */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>): JSX.Element {
  return (
    <kbd
      className={cn(
        'border-border bg-surface text-text-subtle inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-sans text-xs',
        className,
      )}
      {...props}
    />
  );
}
