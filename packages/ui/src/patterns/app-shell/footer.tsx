import { type JSX, type ReactNode } from 'react';
import { type SafetyZone } from '@argoniq/core-domain';
import { cn } from '../../lib/cn.js';
import { StatusDot } from '../../primitives/status-dot.js';

/**
 * Footer. Version + system status + legal/support links. Status is
 * shown as an inline dot (operational/degraded/down) — never a pill. Purely
 * presentational, so it stays server-compatible.
 */

type SystemStatus = 'operational' | 'degraded' | 'down';

const STATUS_TONE: Record<SystemStatus, 'success' | 'warning' | 'danger'> = {
  operational: 'success',
  degraded: 'warning',
  down: 'danger',
};

const STATUS_LABEL: Record<SystemStatus, string> = {
  operational: 'All systems operational',
  degraded: 'Degraded performance',
  down: 'Service disruption',
};

export type FooterProps = {
  /** App version string (e.g. from package version / build id). */
  version?: string;
  /** Coarse system status (drives the inline status dot). */
  status?: SystemStatus;
  /** Optional explicit status label override. */
  statusLabel?: string;
  /** Legal/support links rendered on the right. */
  links?: ReactNode;
  className?: string;
};

/** A footer status tone may also be derived from a SafetyZone for safety surfaces. */
export function statusFromZone(zone: SafetyZone): SystemStatus {
  return zone === 'GREEN' ? 'operational' : zone === 'YELLOW' ? 'degraded' : 'down';
}

export function Footer({
  version,
  status = 'operational',
  statusLabel,
  links,
  className,
}: FooterProps): JSX.Element {
  return (
    <footer
      className={cn(
        'border-border bg-bg text-text-muted flex flex-col gap-2 border-t px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <StatusDot
          tone={STATUS_TONE[status]}
          label={statusLabel ?? STATUS_LABEL[status]}
          className="text-text-muted text-xs"
        />
        {version ? <span>v{version}</span> : null}
      </div>
      {links ? (
        <nav aria-label="Footer" className="flex items-center gap-4">
          {links}
        </nav>
      ) : null}
    </footer>
  );
}
