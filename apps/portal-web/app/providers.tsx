'use client';

import { useState, type JSX, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import NextTopLoader from 'nextjs-toploader';
import { TooltipProvider, toastNotifier } from '@argoniq/ui';
import { trpc } from '../lib/trpc/client.js';

/**
 * Client providers. Wraps the tree in the TanStack Query cache and
 * the tRPC React provider so client components share one deduped, invalidatable
 * server-state cache. The only `'use client'` seam at the root — everything else
 * stays a Server Component for a small bundle and streamed first paint.
 *
 * `superjson` is the transformer on the link (matching the server's tRPC
 * transformer) so Dates/branded values round-trip faithfully. The link targets
 * the `/api/trpc` route handler and batches concurrent calls into one request.
 */

/**
 * Safe, human message from an unknown error. We surface the server's SAFE message
 * (tRPC/envelope) but never leak internal stack text — anything unexpected falls
 * back to a calm generic line.
 */
function safeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message && error.message.length < 200) {
    return error.message;
  }
  return fallback;
}

/**
 * `meta.suppressErrorToast: true` on a query opts out of the centralized refetch
 * toast — for surfaces that render their own inline error affordance.
 */
function isSuppressed(meta: Record<string, unknown> | undefined): boolean {
  return meta?.suppressErrorToast === true;
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    // Centralized BACKGROUND-REFETCH failure notification.
    // Mutation failures are already centralized at the call site via the shared
    // `manageFailed` toast helper, so we deliberately do NOT add a mutation-level
    // handler here (it would double-report). Query first-loads throw to the route
    // error boundary; only a failed refetch of already-visible data toasts.
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (isSuppressed(query.meta)) return;
        if (query.state.data === undefined) return;
        toastNotifier.notify({
          channel: 'toast',
          severity: 'danger',
          title: 'Could not refresh',
          body: safeErrorMessage(
            error,
            'The latest data could not be loaded. Showing the last known values.',
          ),
        });
      },
    }),
    defaultOptions: {
      queries: {
        // Server state is cached; we never refetch unchanged data needlessly.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        // Retry transient failures once; user-visible errors surface fast.
        retry: 1,
      },
      mutations: {
        // Mutations are user intent — never silently retried.
        retry: 0,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  // One QueryClient per browser session (kept stable across re-renders).
  const [queryClient] = useState(makeQueryClient);
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {/* One route indicator. Links/history and nextjs-toploader/app push/replace
            own start/completion; no timed crawl or progress-percentage claim.
            Keep the default template: NProgress locates its bar by role="bar". */}
        <NextTopLoader
          color="var(--mm-color-accent)"
          height={2}
          shadow={false}
          showSpinner={false}
          showForHashAnchor={false}
          crawl={false}
          initialPosition={0.2}
          speed={160}
          zIndex={1600}
        />
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
