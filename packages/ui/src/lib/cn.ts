import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * The single class-name composer for the design system. `clsx` handles
 * conditional/array/object class inputs; `twMerge` resolves conflicting Tailwind
 * utilities so the last one wins (e.g. a variant's `px-3` overrides a base `px-2`).
 * Every primitive/pattern composes its classes through this — never string
 * concatenation.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
