import { z } from 'zod';

/**
 * Cursor pagination — the default for all list endpoints. Cursor pagination is
 * stable under inserts and cheap on indexed columns, so long lists (case
 * queues, parts, fleet tables) never force an offset scan.
 */
export const CursorPaginationInput = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
export type CursorPaginationInput = z.infer<typeof CursorPaginationInput>;

export const PageInfo = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type PageInfo = z.infer<typeof PageInfo>;

export type Page<T> = {
  readonly items: readonly T[];
  readonly pageInfo: PageInfo;
};

/** Build a `Page<z.infer<typeof item>>` schema for a given item schema. */
export function pageOf<Item extends z.ZodTypeAny>(item: Item) {
  return z.object({
    items: z.array(item),
    pageInfo: PageInfo,
  });
}
