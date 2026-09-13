import { forwardRef, type HTMLAttributes } from 'react';
import { type SafetyZone, SAFETY_ZONE_LABELS } from '@argoniq/core-domain';
import { cn } from '../lib/cn.js';

/**
 * SafetyZoneIndicator. Renders the GREEN/YELLOW/RED
 * SafetyZone from core-domain as a tiny colored dot + a thin left-border accent in
 * the matching zone token — never a pill/badge. One consistent safety-color
 * language everywhere. The label text (and aria) carries the meaning, never color
 * alone (WCAG AA). The zone is decided deterministically upstream; this only
 * displays it.
 */

const ZONE_STYLE: Record<SafetyZone, { dot: string; border: string; text: string }> = {
  GREEN: { dot: 'bg-zone-green', border: 'border-l-zone-green', text: 'text-zone-green' },
  YELLOW: { dot: 'bg-zone-amber', border: 'border-l-zone-amber', text: 'text-zone-amber' },
  RED: { dot: 'bg-zone-red', border: 'border-l-zone-red', text: 'text-zone-red' },
};

export type SafetyZoneIndicatorProps = HTMLAttributes<HTMLDivElement> & {
  zone: SafetyZone;
  /** Override the canonical zone label (defaults to SAFETY_ZONE_LABELS[zone]). */
  label?: string;
};

export const SafetyZoneIndicator = forwardRef<HTMLDivElement, SafetyZoneIndicatorProps>(
  function SafetyZoneIndicator({ className, zone, label, ...props }, ref) {
    const style = ZONE_STYLE[zone];
    const text = label ?? SAFETY_ZONE_LABELS[zone];
    return (
      <div
        ref={ref}
        className={cn('flex items-center gap-2 border-l-2 py-1 pl-3', style.border, className)}
        {...props}
      >
        <span className={cn('inline-block size-2 shrink-0 rounded-full', style.dot)} aria-hidden />
        <span className={cn('text-sm font-medium', style.text)}>{text}</span>
      </div>
    );
  },
);
