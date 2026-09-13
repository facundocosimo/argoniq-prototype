import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@argoniq/core/trpc';
import { getLogger, runWithNewContext } from '@argoniq/observability';
import { createTRPCContext } from '../../../../lib/trpc/context.js';

/**
 * The tRPC HTTP transport — a THIN adapter. It builds a per-request
 * `TRPCContext` (resolving the actor), then hands off to `appRouter`, which runs
 * the same validate→authorize→act→audit services and the same AppError→status
 * mapping as the RSC caller. No business logic lives here.
 *
 * The whole handler runs inside `runWithNewContext` so every log line and audit
 * event for the request is tagged with a correlation id and the resolved
 * tenant/user. The browser client (`@trpc/react-query` over
 * httpBatchLink) targets this route.
 */
const logger = getLogger({ transport: 'trpc-http' });

async function handler(request: Request): Promise<Response> {
  const ctx = await createTRPCContext();
  const tags = ctx.service
    ? { tenantId: ctx.service.tenantId, userId: ctx.service.actor.userId }
    : ctx.platform
      ? { userId: ctx.platform.principal.userId }
      : {};
  return runWithNewContext(tags, () =>
    fetchRequestHandler({
      endpoint: '/api/trpc',
      req: request,
      router: appRouter,
      createContext: () => ctx,
      onError({ error, path }) {
        // Keep request failures in the structured application log.
        logger.error({ err: error, path, code: error.code }, 'trpc request failed');
      },
    }),
  );
}

export { handler as GET, handler as POST };
