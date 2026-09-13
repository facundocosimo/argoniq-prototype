import { type Page, type PageInfo } from '@argoniq/contracts';

/** Keyset cursor over (createdAt, id) — stable under inserts, no offset scan. */
export type Keyset = { createdAt: Date; id: string };

export function encodeCursor(value: Keyset): string {
  return Buffer.from(JSON.stringify({ t: value.createdAt.toISOString(), id: value.id })).toString(
    'base64url',
  );
}

export function decodeCursor(cursor: string): Keyset | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      t: string;
      id: string;
    };
    return { createdAt: new Date(parsed.t), id: parsed.id };
  } catch {
    return null;
  }
}

/**
 * Turn a `limit + 1` row fetch into a `Page<T>`. The extra row tells us whether
 * there is a next page without a count query; the cursor is the last kept row's
 * keyset.
 */
export function toPage<T>(rows: T[], limit: number, keyset: (row: T) => Keyset): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const pageInfo: PageInfo = {
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(keyset(last)) : null,
  };
  return { items, pageInfo };
}
