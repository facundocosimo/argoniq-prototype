'use client';

import { type JSX } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@argoniq/ui';
import { exitImpersonation } from '../lib/demo/switch.js';

/**
 * Impersonation banner — the always-visible marker that the platform operator is
 * inside an OEM's portal as its admin. Impersonation is a privileged, audited act;
 * it must never be silent. "Exit" clears it and returns to the platform console.
 * Uses the amber (caution) zone token, consistent with the safety vocabulary.
 */
export function ImpersonationBanner({ tenantName }: { tenantName: string }): JSX.Element {
  return (
    <div
      role="status"
      className="border-zone-amber/40 bg-zone-amber-subtle text-text flex items-center gap-3 border-b px-4 py-2 text-sm sm:px-6"
    >
      <ShieldAlert className="text-zone-amber size-4 shrink-0" aria-hidden />
      <p className="min-w-0">
        Impersonating <strong className="font-semibold">{tenantName}</strong> as an OEM admin —
        actions are performed as this tenant and audited to you.
      </p>
      <Button
        size="sm"
        variant="secondary"
        className="ml-auto shrink-0"
        onClick={() => void exitImpersonation()}
      >
        Exit
      </Button>
    </div>
  );
}
