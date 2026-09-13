'use client';

import { useEffect, useState } from 'react';
import { useWorkspaceScope } from './workspace-access.js';

/** Small per-user/workspace view preferences. Storage failure never blocks a task. */
export function useWorkspacePreference<T extends string | boolean>(
  name: string,
  initial: T,
): [T, (value: T) => void] {
  const scope = useWorkspaceScope();
  const key = `argoniq:view:${scope}:${name}`;
  const [value, setValue] = useState(initial);
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
      setValue(typeof stored === typeof initial ? (stored as T) : initial);
    } catch {
      setValue(initial);
    }
  }, [key, initial]);
  return [
    value,
    (next) => {
      setValue(next);
      try {
        sessionStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* Optional. */
      }
    },
  ];
}
