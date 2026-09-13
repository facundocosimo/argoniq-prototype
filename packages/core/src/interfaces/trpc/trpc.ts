import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { type ErrorCode } from '@argoniq/contracts';
import { getContext, isAppError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { type PlatformContext } from '../../platform-context.js';

/**
 * tRPC context — one transport over the service layer. The app resolves
 * the request principal and builds the matching context: a tenant `ServiceContext`
 * for OEM/customer principals, or a `PlatformContext` for the platform operator.
 * Exactly one is non-null (both are null when unauthenticated). A platform operator
 * impersonating a tenant resolves as a `ServiceContext`, not `platform` — so all
 * OEM data access stays RLS-scoped.
 */
export interface TRPCContext {
  readonly service: ServiceContext | null;
  readonly platform: PlatformContext | null;
}

const ERROR_CODE_TO_TRPC: Record<ErrorCode, TRPCError['code']> = {
  VALIDATION: 'BAD_REQUEST',
  UNAUTHENTICATED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'TOO_MANY_REQUESTS',
  UNSAFE_REQUEST: 'FORBIDDEN',
  GROUNDING_FAILED: 'UNPROCESSABLE_CONTENT',
  TENANT_ISOLATION: 'FORBIDDEN',
  INTERNAL: 'INTERNAL_SERVER_ERROR',
};

const INTERNAL_ERROR_MESSAGE = 'The request could not be completed. Please try again.';

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    const hideMessage =
      error.code === 'INTERNAL_SERVER_ERROR' || (isAppError(cause) && !cause.expose);
    // Development stacks can contain the original SQL, parameters or provider payload.
    // Keep those on the server via onError; only the reference belongs in the response.
    const { stack: _stack, ...data } = shape.data;
    return {
      ...shape,
      message: hideMessage ? INTERNAL_ERROR_MESSAGE : shape.message,
      data: {
        ...data,
        correlationId: getContext()?.correlationId,
        appCode: isAppError(cause) ? cause.code : undefined,
      },
    };
  },
});

/**
 * Maps our typed `AppError`s onto tRPC error codes in one place, and never leaks
 * a non-exposable message (TenantIsolation/Internal). Unknown errors stay
 * INTERNAL_SERVER_ERROR with a safe message. The original cause stays server-side.
 */
const errorMiddleware = t.middleware(async ({ next }) => {
  // tRPC returns downstream failures as a result; they do not escape next as throws.
  const result = await next();
  if (!result.ok && isAppError(result.error.cause)) {
    const error = result.error.cause;
    throw new TRPCError({
      code: ERROR_CODE_TO_TRPC[error.code],
      cause: error,
      message: error.expose ? error.message : INTERNAL_ERROR_MESSAGE,
    });
  }
  if (!result.ok && result.error.code === 'INTERNAL_SERVER_ERROR') {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: INTERNAL_ERROR_MESSAGE,
      cause: result.error,
    });
  }
  return result;
});

export const router = t.router;
export const middleware = t.middleware;
export const baseProcedure = t.procedure.use(errorMiddleware);

/** Requires an authenticated tenant service context. Narrows `ctx.service` to non-null. */
export const protectedProcedure = baseProcedure.use(({ ctx, next }) => {
  if (!ctx.service) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { service: ctx.service } });
});

/**
 * Requires a platform-operator context (super-admin). Narrows `ctx.platform` to
 * non-null. This is the structural gate on every cross-tenant platform operation —
 * a tenant principal never carries a `PlatformContext`, so it cannot reach here.
 */
export const platformProcedure = baseProcedure.use(({ ctx, next }) => {
  if (!ctx.platform) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx: { platform: ctx.platform } });
});

/** Public (unauthenticated) procedure — still error-mapped. */
export const publicProcedure = baseProcedure;
