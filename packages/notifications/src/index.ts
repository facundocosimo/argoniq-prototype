/**
 * @argoniq/notifications — the one notification system.
 * Shared contract here; the UI presentation (toasts/banners/inbox) composes it
 * in packages/ui, and the server emits async outcomes through the same shapes.
 */
export * from './notification.js';
export * from './notifier.js';
