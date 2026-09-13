'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { type NavItem } from '@argoniq/ui';
import { usePageChrome } from './page-chrome.js';

type Recent = Record<string, NavItem[]>;
const UUID = '[0-9a-fA-F-]{36}';
const CATEGORIES: [string, RegExp][] = [
  ['machines', new RegExp(`^/machines/${UUID}$`)],
  ['companies', new RegExp(`^/manage/companies/${UUID}$`)],
  ['cases', new RegExp(`^/cases/${UUID}$`)],
  ['documents', new RegExp(`^/technical-information/${UUID}$`)],
];

function isStoredNavItem(value: unknown, pattern: RegExp): value is NavItem {
  return (
    value !== null &&
    typeof value === 'object' &&
    'key' in value &&
    typeof value.key === 'string' &&
    'label' in value &&
    typeof value.label === 'string' &&
    'href' in value &&
    typeof value.href === 'string' &&
    pattern.test(value.href)
  );
}

/** Labels are browsing conveniences, never permission evidence. Destinations reauthorize. */
export function useRecentRecords(scope: string): Recent {
  const pathname = usePathname();
  const { chrome } = usePageChrome();
  const [state, setState] = useState<{ scope: string; records: Recent }>({
    scope: '',
    records: {},
  });
  useEffect(() => {
    const records: Recent = {};
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(`argoniq:recent:${scope}`) ?? '{}');
      if (stored && typeof stored === 'object')
        for (const [category, pattern] of CATEGORIES) {
          const values = (stored as Record<string, unknown>)[category];
          if (Array.isArray(values)) {
            records[category] = values
              .filter((value: unknown) => isStoredNavItem(value, pattern))
              .slice(0, 5);
          }
        }
    } catch {
      /* Browsing still works when storage is unavailable. */
    }
    setState({ scope, records });
  }, [scope]);
  useEffect(() => {
    if (state.scope !== scope || chrome.pathname !== pathname || !chrome.title) return;
    const category = CATEGORIES.find(([, pattern]) => pattern.test(pathname))?.[0];
    if (!category) return;
    const previous = state.records[category] ?? [];
    if (previous[0]?.href === pathname && previous[0]?.label === chrome.title) return;
    const records = {
      ...state.records,
      [category]: [
        { key: pathname, href: pathname, label: chrome.title },
        ...previous.filter((item) => item.href !== pathname),
      ].slice(0, 5),
    };
    setState({ scope, records });
    try {
      sessionStorage.setItem(`argoniq:recent:${scope}`, JSON.stringify(records));
    } catch {
      /* Optional. */
    }
  }, [scope, state, pathname, chrome.pathname, chrome.title]);
  return state.scope === scope ? state.records : {};
}
