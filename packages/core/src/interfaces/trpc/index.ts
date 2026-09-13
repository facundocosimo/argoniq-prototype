/**
 * tRPC interface — the primary UI transport (one adapter over the service layer).
 * The app mounts `appRouter` and builds the `TRPCContext` per request.
 */
export { appRouter, type AppRouter } from './routers/index.js';
export {
  type TRPCContext,
  router,
  middleware,
  baseProcedure,
  protectedProcedure,
  publicProcedure,
} from './trpc.js';
