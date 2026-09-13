'use client';

import { type JSX } from 'react';
import { Button, ErrorState } from '@argoniq/ui';
// global-error replaces the root layout entirely, so it must render <html>/<body>
// and re-import the design-system stylesheet.
import './globals.css';

/**
 * Global error boundary. The last line of defense — catches errors
 * that escape the root layout. Renders the centralized ErrorState with the safe
 * `digest` as a support reference (never internal error text) and a recovery action.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  return (
    <html lang="en" data-theme="light">
      <body>
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
          <ErrorState
            title="Something went wrong"
            description="An unexpected error interrupted the application. You can try again, or contact support if it persists."
            {...(error.digest ? { correlationId: error.digest } : {})}
            action={
              <Button variant="secondary" size="sm" onClick={reset}>
                Try again
              </Button>
            }
          />
        </div>
      </body>
    </html>
  );
}
