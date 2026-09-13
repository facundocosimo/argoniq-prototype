import { forwardRef, type HTMLAttributes, type JSX } from 'react';
import { cn } from '../lib/cn.js';

/**
 * Skeleton. A calm placeholder for first paint and lazy-loaded
 * lists/viewers. Subtle pulse on the surface token — no shimmer gradient.
 * Presentational, so server-compatible. Hidden from assistive tech (it is purely
 * a loading affordance; pair it with a Spinner's role=status when needed).
 */
export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn('bg-surface animate-pulse rounded-md', className)}
      {...props}
    />
  );
});

/**
 * TableSkeleton — the loading affordance for the DataTable shell. Mirrors the
 * table's bordered card + header + rows so first paint doesn't shift. Announces
 * politely (role=status) while data resolves.
 */
export type TableSkeletonProps = HTMLAttributes<HTMLDivElement> & {
  rows?: number;
  columns?: number;
};

export function TableSkeleton({
  rows = 6,
  columns = 3,
  className,
  ...props
}: TableSkeletonProps): JSX.Element {
  const columnKeys = Array.from({ length: columns }, (_, i) => `c${i}`);
  const rowKeys = Array.from({ length: rows }, (_, i) => `r${i}`);
  return (
    <div
      role="status"
      aria-busy
      className={cn('border-border bg-bg overflow-hidden rounded-lg border shadow-xs', className)}
      {...props}
    >
      <span className="sr-only">Loading…</span>
      <div className="border-border flex items-center gap-4 border-b px-4 py-2.5">
        {columnKeys.map((key) => (
          <Skeleton key={key} className="h-3 w-24" />
        ))}
      </div>
      <div className="divide-border divide-y">
        {rowKeys.map((rowKey) => (
          <div key={rowKey} className="flex items-center gap-4 px-4 py-3">
            {columnKeys.map((colKey, c) => (
              <Skeleton key={colKey} className={cn('h-4', c === 0 ? 'w-40' : 'w-24')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * CardSkeleton — the loading affordance for a Card surface (detail panes, the
 * effective-config card, answer panels).
 */
export type CardSkeletonProps = HTMLAttributes<HTMLDivElement> & {
  lines?: number;
};

export function CardSkeleton({ lines = 3, className, ...props }: CardSkeletonProps): JSX.Element {
  const lineKeys = Array.from({ length: lines }, (_, i) => `l${i}`);
  return (
    <div
      role="status"
      aria-busy
      className={cn('border-border bg-bg rounded-lg border p-4 shadow-xs', className)}
      {...props}
    >
      <span className="sr-only">Loading…</span>
      <Skeleton className="mb-3 h-4 w-32" />
      <div className="flex flex-col gap-2">
        {lineKeys.map((key) => (
          <Skeleton key={key} className="h-3 w-full" />
        ))}
      </div>
    </div>
  );
}
