import {
  GetSerialDetailInput,
  GetSerialInput,
  ListInstalledBaseInput,
  ListSerialsInput,
  ResolveEffectiveConfigInput,
  ResolveSerialOptionsInput,
  SetSerialCustomerTagInput,
  getSerial,
  getSerialDetail,
  listInstalledBase,
  listSerials,
  resolveEffectiveConfig,
  resolveSerialOptions,
  setSerialCustomerTag,
} from '../../../services/machine/index.js';
import { protectedProcedure, router } from '../trpc.js';

/**
 * Machine router — a THIN adapter. Each procedure parses input (tRPC), then calls
 * the service, which re-validates and re-authorizes. No logic lives here.
 */
export const machineRouter = router({
  getSerial: protectedProcedure
    .input(GetSerialInput)
    .query(({ ctx, input }) => getSerial(ctx.service, input)),

  getSerialDetail: protectedProcedure
    .input(GetSerialDetailInput)
    .query(({ ctx, input }) => getSerialDetail(ctx.service, input)),

  setCustomerTag: protectedProcedure
    .input(SetSerialCustomerTagInput)
    .mutation(({ ctx, input }) => setSerialCustomerTag(ctx.service, input)),

  listSerials: protectedProcedure
    .input(ListSerialsInput)
    .query(({ ctx, input }) => listSerials(ctx.service, input)),

  listInstalledBase: protectedProcedure
    .input(ListInstalledBaseInput)
    .query(({ ctx, input }) => listInstalledBase(ctx.service, input)),

  resolveConfig: protectedProcedure
    .input(ResolveEffectiveConfigInput)
    .query(({ ctx, input }) => resolveEffectiveConfig(ctx.service, input)),

  resolveOptions: protectedProcedure
    .input(ResolveSerialOptionsInput)
    .query(({ ctx, input }) => resolveSerialOptions(ctx.service, input)),
});
