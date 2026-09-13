import { type Notification, type NotificationSeverity } from './notification.js';

/** Input to dispatch a notification (id/createdAt are filled by the notifier). */
export type NotificationInput = Omit<Notification, 'id' | 'createdAt'> &
  Partial<Pick<Notification, 'createdAt'>>;

/**
 * The single dispatch surface. The client builds a UI-bound
 * notifier (toasts/inbox) on top; the server builds an event-emitting one for
 * async outcomes (case created, ingestion finished, fleet alert). Components
 * call `notify` / the severity shortcuts — never their own alert.
 */
export interface Notifier {
  notify(input: NotificationInput): void;
}

type Shortcut = (title: string, rest?: Partial<NotificationInput>) => void;

export interface SeverityNotifier extends Notifier {
  info: Shortcut;
  success: Shortcut;
  warning: Shortcut;
  danger: Shortcut;
}

function shortcut(notifier: Notifier, severity: NotificationSeverity): Shortcut {
  return (title, rest) => notifier.notify({ severity, channel: 'toast', title, ...rest });
}

/** Wrap a base `Notifier` with `info/success/warning/danger` shortcuts. */
export function withSeverityShortcuts(notifier: Notifier): SeverityNotifier {
  return {
    notify: (input) => notifier.notify(input),
    info: shortcut(notifier, 'info'),
    success: shortcut(notifier, 'success'),
    warning: shortcut(notifier, 'warning'),
    danger: shortcut(notifier, 'danger'),
  };
}

/** Collecting notifier for tests/SSR — records dispatched notifications. */
export function createCollectingNotifier(): SeverityNotifier & {
  readonly sent: NotificationInput[];
} {
  const sent: NotificationInput[] = [];
  const base: Notifier = { notify: (input) => void sent.push(input) };
  return Object.assign(withSeverityShortcuts(base), { sent });
}
