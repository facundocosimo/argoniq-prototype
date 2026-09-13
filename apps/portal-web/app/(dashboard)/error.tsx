'use client';

import { type JSX } from 'react';
import { Button, ErrorState } from '@argoniq/ui';

/**
 * Dashboard error boundary. Catches render/data errors within the
 * dashboard segment and shows the centralized ErrorState inside the app-shell, so
 * the chrome and navigation stay intact. `digest` is the safe support reference;
 * `reset` re-renders the segment.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <ErrorState
        {...(error.digest ? { correlationId: error.digest } : {})}
        action={
          <Button variant="secondary" size="sm" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
