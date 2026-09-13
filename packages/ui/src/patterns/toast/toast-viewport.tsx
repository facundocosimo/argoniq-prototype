'use client';

import { useEffect, type JSX } from 'react';
import { X } from 'lucide-react';
import { type Notification, type NotificationSeverity } from '@argoniq/notifications';
import { cn } from '../../lib/cn.js';
import { StatusDot } from '../../primitives/status-dot.js';
import { useToast } from './use-toast.js';

/**
 * ToastViewport. Renders the live toasts from the one toast store
 * as calm, bordered surfaces — not bubbly cards, no pill. Severity maps to the
 * same semantic dot language via StatusDot. Auto-dismisses after `durationMs`;
 * sticky otherwise. The region is an aria-live polite landmark so async outcomes
 * (case created, ingestion finished) are announced. Mount once, near the shell.
 */

const SEVERITY_TONE: Record<NotificationSeverity, 'info' | 'success' | 'warning' | 'danger'> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

/**
 * Textual equivalent for each severity (WCAG 1.4.1 — never color alone). Rendered
 * sr-only so the meaning reaches screen readers; the dot stays decorative.
 */
const SEVERITY_LABEL: Record<NotificationSeverity, string> = {
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  danger: 'Error',
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Notification;
  onDismiss: (id: string) => void;
}): JSX.Element {
  useEffect(() => {
    if (toast.durationMs === undefined) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  // Danger announces assertively (role=alert); other severities are polite status.
  const role = toast.severity === 'danger' ? 'alert' : 'status';

  return (
    <div
      role={role}
      className={cn(
        'border-border bg-bg pointer-events-auto flex w-full items-start gap-3 rounded-md border p-3 shadow-sm',
      )}
    >
      <StatusDot tone={SEVERITY_TONE[toast.severity]} className="mt-1 gap-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-text text-sm font-medium">
          <span className="sr-only">{SEVERITY_LABEL[toast.severity]}: </span>
          {toast.title}
        </p>
        {toast.body ? <p className="text-text-muted mt-0.5 text-sm">{toast.body}</p> : null}
        {toast.href ? (
          <a
            href={toast.href}
            className="text-accent focus-visible:outline-focus mt-1 inline-block text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            View
          </a>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="text-text-muted hover:text-text focus-visible:outline-focus shrink-0 rounded-sm p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function ToastViewport(): JSX.Element {
  const { toasts, dismiss } = useToast();
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}
