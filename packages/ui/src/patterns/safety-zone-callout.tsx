import { type HTMLAttributes, type JSX, type ReactNode } from 'react';
import { CircleCheck, ShieldAlert, TriangleAlert } from 'lucide-react';
import { type SafetyZone, SAFETY_ZONE_LABELS } from '@argoniq/core-domain';
import { cn } from '../lib/cn.js';

/**
 * SafetyZoneCallout  — the prominent zone treatment for an
 * answer/case: a softly tinted panel + a zone icon + label + optional guidance.
 * One consistent safety-color language, with real presence (this is a precise
 * industrial-safety surface) — but still calm: a 1px tinted border over a subtle
 * wash, never a heavy alert. Meaning is in the icon + label, not color alone.
 * The compact inline `SafetyZoneIndicator` remains for dense rows.
 */
const ZONE_STYLE: Record<SafetyZone, { wrap: string; text: string; icon: ReactNode }> = {
  GREEN: {
    wrap: 'border-zone-green/25 bg-zone-green-subtle',
    text: 'text-zone-green',
    icon: <CircleCheck className="size-4" aria-hidden />,
  },
  YELLOW: {
    wrap: 'border-zone-amber/25 bg-zone-amber-subtle',
    text: 'text-zone-amber',
    icon: <TriangleAlert className="size-4" aria-hidden />,
  },
  RED: {
    wrap: 'border-zone-red/25 bg-zone-red-subtle',
    text: 'text-zone-red',
    icon: <ShieldAlert className="size-4" aria-hidden />,
  },
};

export type SafetyZoneCalloutProps = HTMLAttributes<HTMLDivElement> & {
  zone: SafetyZone;
  /** Override the canonical zone label. */
  label?: string;
  /** Optional one-line guidance under the label (customer-safe). */
  children?: ReactNode;
};

export function SafetyZoneCallout({
  zone,
  label,
  children,
  className,
  ...props
}: SafetyZoneCalloutProps): JSX.Element {
  const style = ZONE_STYLE[zone];
  return (
    <div
      className={cn('flex gap-2.5 rounded-md border px-3 py-2.5', style.wrap, className)}
      {...props}
    >
      <span className={cn('mt-px shrink-0', style.text)}>{style.icon}</span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={cn('text-sm font-medium', style.text)}>
          {label ?? SAFETY_ZONE_LABELS[zone]}
        </span>
        {children ? <span className="text-text-muted text-xs">{children}</span> : null}
      </div>
    </div>
  );
}
