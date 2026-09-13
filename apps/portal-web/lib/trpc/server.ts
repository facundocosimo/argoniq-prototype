import 'server-only';

import { cache } from 'react';
import { appRouter } from '@argoniq/core/trpc';
import { runWithNewContext } from '@argoniq/observability';
import { createTRPCContext } from './context.js';

/**
 * The RSC server bridge — how Server Components read the service layer WITHOUT an
 * HTTP round-trip (treat every avoidable round-trip as a defect).
 * It calls `appRouter` directly with a per-request `TRPCContext`, so the same
 * services, the same validate→authorize→act→audit path, and the same error
 * mapping apply as over HTTP. RSC never reaches into service internals; it goes
 * through this one contract.
 *
 * `cache` memoizes the context + caller per render so repeated reads share one
 * resolved actor/context (dedupe). Each call is run inside `runWithNewContext`
 * so every log line + audit event for that read is tagged with a correlation id
 * and the resolved tenant/user — exactly like the HTTP route handler.
 */
const getRequestContext = cache(() => createTRPCContext());

type Caller = ReturnType<typeof appRouter.createCaller>;

/** Request-scoped logger/audit tags — the tenant for OEM/customer principals, the
 *  operator's user id for the platform principal. Branded types are preserved. */
function contextTags(ctx: Awaited<ReturnType<typeof createTRPCContext>>) {
  if (ctx.service) return { tenantId: ctx.service.tenantId, userId: ctx.service.actor.userId };
  if (ctx.platform) return { userId: ctx.platform.principal.userId };
  return {};
}

/**
 * Run a read against the service layer from a Server Component. The callback
 * receives the tRPC caller; the whole call runs inside a fresh async context so
 * logging/audit are correlated and tenant-tagged.
 *
 * @example
 *   const serials = await serverQuery((api) => api.machine.listSerials({ limit: 50 }));
 */
export async function serverQuery<T>(fn: (api: Caller) => Promise<T>): Promise<T> {
  const ctx = await getRequestContext();
  return runWithNewContext(contextTags(ctx), () => fn(appRouter.createCaller(ctx)));
}
