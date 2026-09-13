import { z } from 'zod';
import { type SafetyZone } from '@argoniq/core-domain';

/**
 * Centralized notification model. Severity maps to the same
 * semantic token language used everywhere — so a warning toast, a warning
 * banner, and a YELLOW safety marker share one color vocabulary. Components
 * dispatch these; they never render ad-hoc alerts.
 */
export const NOTIFICATION_SEVERITIES = ['info', 'success', 'warning', 'danger'] as const;
export const NotificationSeverity = z.enum(NOTIFICATION_SEVERITIES);
export type NotificationSeverity = z.infer<typeof NotificationSeverity>;

/** Where a notification surfaces. One system, multiple presentations. */
export const NOTIFICATION_CHANNELS = ['toast', 'banner', 'inbox'] as const;
export const NotificationChannel = z.enum(NOTIFICATION_CHANNELS);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

export const Notification = z.object({
  id: z.string(),
  severity: NotificationSeverity,
  channel: NotificationChannel.default('toast'),
  title: z.string().min(1),
  body: z.string().optional(),
  /** Optional deep link the notification points to (e.g. a created serviceCase). */
  href: z.string().optional(),
  /** Auto-dismiss after N ms (toasts). Sticky if omitted. */
  durationMs: z.number().int().positive().optional(),
  createdAt: z.date(),
});
export type Notification = z.infer<typeof Notification>;

/** Map a safety zone to the matching notification severity (one color language). */
export function severityFromZone(zone: SafetyZone): NotificationSeverity {
  switch (zone) {
    case 'GREEN':
      return 'success';
    case 'YELLOW':
      return 'warning';
    case 'RED':
      return 'danger';
  }
}
