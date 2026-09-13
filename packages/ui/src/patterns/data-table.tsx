'use client';

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  flexRender,
  globalFilteringFeature,
  metaHelper,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef as TableColumnDef,
  type Row as TableRow,
  type RowData,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import { Input } from '../primitives/input.js';
import { TableSkeleton } from '../primitives/skeleton.js';

export const TablePreferenceScope = createContext('');

/**
 * DataTable  — the one table for the whole system. Every tabular
 * surface renders through this, so the format is identical everywhere: a crisp
 * bordered, hairline-ruled ("Notion line") table with quiet zebra striping for
 * scan-ability, uppercase header labels, and — where a column enables sorting —
 * a full-cell header button that highlights on hover and carries a sort arrow
 * (`aria-sort` for AT). On mobile it collapses to a calm card list. Token-driven;
 * no vertical rules, no pills.
 *
 * Column extras via `meta`:
 *   • `align: 'right'` — right-align the header + cells (use for numbers/counts).
 *
 * Sorting is client-side over the loaded page (keyset pagination is server-driven);
 * lift sorting to URL state when cross-page sort is needed.
 *
 * Render this from a Client Component that owns its `columns` (cell renderers are
 * functions and cannot cross the RSC boundary): fetch on the server, pass plain
 * rows down, define columns in the client wrapper.
 */

const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  columnVisibilityFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  columnMeta: metaHelper<{ align?: 'left' | 'right' }>(),
});

/** Column definition bound to the feature set owned by DataTable. */
export type ColumnDef<TData extends RowData, TValue = unknown> = TableColumnDef<
  typeof dataTableFeatures,
  TData,
  TValue
>;

export type DataTablePagination = {
  hasMore: boolean;
  isFetching?: boolean;
  canPrev?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
};

export type DataTableProps<TData extends RowData> = {
  columns: ColumnDef<TData>[];
  data: readonly TData[];
  /** Stable row id (defaults to row index). */
  getRowId?: (row: TData, index: number) => string;
  /** Row hover affordance (default on). Pair with a focusable link in the primary
   *  cell for navigation — rows themselves are not click targets. */
  interactiveRows?: boolean;
  /** Per-row mobile (<md) rendering. Falls back to a label:value list of cells. */
  renderMobileCard?: (row: TData) => ReactNode;
  enableSorting?: boolean;
  isLoading?: boolean;
  /** Shown in place of the body when there are no rows (e.g. an EmptyState). */
  empty?: ReactNode;
  /** Shown in place of the table when the load failed (e.g. an ErrorState). */
  error?: ReactNode;
  /** Accessible table caption (visually hidden). */
  caption?: string;
  pagination?: DataTablePagination;
  className?: string;
  /** Filter the loaded rows. Server-wide search belongs to the feature service. */
  searchable?: boolean;
};

function SortIcon({ state }: { state: false | 'asc' | 'desc' }): JSX.Element {
  if (state === 'asc') return <ChevronUp className="text-accent size-3.5" aria-hidden />;
  if (state === 'desc') return <ChevronDown className="text-accent size-3.5" aria-hidden />;
  // Unsorted-but-sortable: a faint hint that darkens with the header on hover.
  return (
    <ChevronsUpDown
      className="text-text-subtle/70 group-hover:text-text-muted size-3.5 transition-colors"
      aria-hidden
    />
  );
}

function isSortingEntry(value: unknown): value is SortingState[number] {
  return (
    value !== null &&
    typeof value === 'object' &&
    'id' in value &&
    typeof value.id === 'string' &&
    'desc' in value &&
    typeof value.desc === 'boolean'
  );
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  interactiveRows = true,
  renderMobileCard,
  enableSorting = true,
  isLoading = false,
  empty,
  error,
  caption,
  pagination,
  className,
  searchable = true,
}: DataTableProps<TData>): JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filter, setFilter] = useState('');
  const scope = useContext(TablePreferenceScope);
  const inputId = useId();
  const [storageKey, setStorageKey] = useState('');
  useEffect(() => {
    const key = `argoniq:table:${scope}:${window.location.pathname}:${caption ?? 'records'}`;
    setStorageKey(key);
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? '{}');
      const preference =
        saved !== null && typeof saved === 'object'
          ? (saved as { filter?: unknown; sorting?: unknown })
          : {};
      setFilter(typeof preference.filter === 'string' ? preference.filter : '');
      setSorting(
        Array.isArray(preference.sorting) ? preference.sorting.filter(isSortingEntry) : [],
      );
    } catch {
      setFilter('');
      setSorting([]);
    }
  }, [scope, caption]);
  const remember = (nextFilter: string, nextSorting: SortingState): void => {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ filter: nextFilter, sorting: nextSorting }),
      );
    } catch {
      /* Optional preference. */
    }
  };

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    state: { sorting, globalFilter: searchable ? filter : '' },
    onSortingChange: (update) => {
      const next = typeof update === 'function' ? update(sorting) : update;
      setSorting(next);
      remember(filter, next);
    },
    globalFilterFn: 'includesString',
    enableSorting,
    ...(getRowId ? { getRowId } : {}),
  });

  if (error) return <>{error}</>;
  if (isLoading) return <TableSkeleton columns={columns.length} className={className} />;

  const rows = table.getRowModel().rows;
  if (data.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={cn('w-full', className)}>
      {searchable ? (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="w-full sm:max-w-sm">
            <label htmlFor={inputId} className="text-text-muted mb-1 block text-xs font-medium">
              Search {caption?.toLowerCase() ?? 'records'}
            </label>
            <Input
              id={inputId}
              type="search"
              value={filter}
              placeholder="Search loaded records…"
              onChange={(event) => {
                setFilter(event.target.value);
                remember(event.target.value, sorting);
              }}
            />
          </div>
          <span role="status" className="text-text-muted nums-tabular pb-2 text-xs">
            {rows.length} of {data.length} loaded
          </span>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p role="status" className="border-border bg-bg text-text-muted border p-6 text-sm">
          No matching records. Change or clear your search.
        </p>
      ) : null}
      {/* Desktop: bordered, hairline-ruled, zebra-striped table. */}
      <div className="border-border bg-bg hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-border bg-surface border-b">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const alignRight = header.column.columnDef.meta?.align === 'right';
                  const label = header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext());
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : undefined
                      }
                      className="p-0 text-left align-middle"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        // Full-cell button: the WHOLE header cell highlights on hover.
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            'group ease-out-fast flex w-full items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors duration-150',
                            'hover:bg-surface-subtle focus-visible:outline-focus focus-visible:outline-2 focus-visible:-outline-offset-2',
                            sorted ? 'text-text' : 'text-text-muted hover:text-text',
                            alignRight && 'justify-end text-right',
                          )}
                        >
                          {label}
                          <SortIcon state={sorted} />
                        </button>
                      ) : (
                        <div
                          className={cn(
                            'text-text-muted px-4 py-2 text-xs font-semibold',
                            alignRight && 'text-right',
                          )}
                        >
                          {label}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'border-border border-b last:border-0',
                  interactiveRows &&
                    'ease-out-fast hover:bg-accent-subtle/50 focus-within:bg-accent-subtle/50 transition-colors duration-150',
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      'text-text px-4 py-2.5 align-middle',
                      cell.column.columnDef.meta?.align === 'right' && 'text-right',
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: calm card list. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            className={cn(
              'border-border bg-bg min-w-0 rounded-lg border p-3',
              interactiveRows && 'ease-out-fast hover:bg-surface transition-colors duration-150',
            )}
          >
            {renderMobileCard ? renderMobileCard(row.original) : <DefaultMobileRow row={row} />}
          </li>
        ))}
      </ul>

      {pagination ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          {pagination.onPrev ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={pagination.onPrev}
              disabled={!pagination.canPrev || pagination.isFetching}
            >
              Previous
            </Button>
          ) : null}
          {pagination.onNext ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={pagination.onNext}
              disabled={!pagination.hasMore || pagination.isFetching}
            >
              Next
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Fallback mobile row: each visible cell as a label:value line. */
function DefaultMobileRow<TData extends RowData>({
  row,
}: {
  row: TableRow<typeof dataTableFeatures, TData>;
}): JSX.Element {
  return (
    <dl className="flex flex-col gap-1.5">
      {row.getVisibleCells().map((cell) => {
        const header = cell.column.columnDef.header;
        const label = typeof header === 'string' ? header : cell.column.id;
        return (
          <div
            key={cell.id}
            className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
          >
            <dt className="text-text-muted shrink-0 text-xs">{label}</dt>
            <dd className="text-text min-w-0 text-sm break-words sm:text-right">
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
