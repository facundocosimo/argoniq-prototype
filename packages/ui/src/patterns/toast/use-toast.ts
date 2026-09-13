'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  type Notification,
  type NotificationInput,
  type Notifier,
  type SeverityNotifier,
  withSeverityShortcuts,
} from '@argoniq/notifications';

/**
 * useToast — the client-side toast surface. Built directly on the
 * @argoniq/notifications model (Notification / Notifier / SeverityNotifier),
 * adding NO new notification concept. Components dispatch through this single
 * surface — never an ad-hoc alert. The store is module-scoped so a toast fired
 * from anywhere in the tree reaches the one ToastViewport.
 */

type ToastStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => Notification[];
  push: (input: NotificationInput) => string;
  dismiss: (id: string) => void;
};

function createToastStore(): ToastStore {
  let toasts: Notification[] = [];
  const listeners = new Set<() => void>();
  let counter = 0;

  const emit = (): void => {
    for (const listener of listeners) listener();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getSnapshot() {
      return toasts;
    },
    push(input) {
      counter += 1;
      const id = `toast-${String(counter)}`;
      const toast: Notification = {
        id,
        channel: input.channel ?? 'toast',
        severity: input.severity,
        title: input.title,
        createdAt: input.createdAt ?? new Date(),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.href !== undefined ? { href: input.href } : {}),
        ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
      };
      toasts = [...toasts, toast];
      emit();
      return id;
    },
    dismiss(id) {
      toasts = toasts.filter((t) => t.id !== id);
      emit();
    },
  };
}

const store = createToastStore();

/** The module-scoped notifier — usable from non-React code paths (e.g. mutation callbacks). */
export const toastNotifier: Notifier = { notify: (input) => void store.push(input) };

/** Severity shortcuts over the module-scoped notifier (one dispatch contract). */
const severityNotifier: SeverityNotifier = withSeverityShortcuts(toastNotifier);

export type ToastApi = SeverityNotifier & {
  /** Current live toasts (read by ToastViewport). */
  toasts: Notification[];
  /** Dismiss a toast by id (auto-called on duration timeout / user close). */
  dismiss: (id: string) => void;
};

/**
 * Subscribe to the toast store and get the dispatch surface. The returned
 * `notify` + severity shortcuts come straight from `withSeverityShortcuts`, so
 * there is one dispatch contract shared with the server-side notifier.
 */
export function useToast(): ToastApi {
  const toasts = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const dismiss = useCallback((id: string) => store.dismiss(id), []);

  return useMemo<ToastApi>(() => ({ ...severityNotifier, toasts, dismiss }), [toasts, dismiss]);
}
