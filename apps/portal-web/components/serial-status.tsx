import { type JSX } from 'react';
import { type SerialStatus } from '@argoniq/core-domain';
import { StatusDot } from '@argoniq/ui';

/**
 * Inline, typographic status for a Serial's lifecycle (a small dot
 * + label, never a pill/badge). Maps each canonical `SerialStatus` to the one
 * semantic dot language and a human label. Meaning is in the label, never color
 * alone (WCAG AA). Presentation only — the canonical statuses live in core-domain.
 */
const STATUS_LABEL: Record<SerialStatus, string> = {
  not_installed: 'Not installed',
  active: 'Active',
  in_service: 'In service',
  maintenance: 'Under maintenance',
  decommissioned: 'Decommissioned',
};

const STATUS_TONE: Record<SerialStatus, 'success' | 'info' | 'warning' | 'neutral'> = {
  not_installed: 'neutral',
  active: 'info',
  in_service: 'success',
  maintenance: 'warning',
  decommissioned: 'neutral',
};

export function SerialStatusText({ status }: { status: SerialStatus }): JSX.Element {
  return <StatusDot tone={STATUS_TONE[status]} label={STATUS_LABEL[status]} className="text-xs" />;
}
