import {
  GetInstallationInput,
  ListInstallationsInput,
  getInstallation,
  listInstallations,
} from '../../../services/installation/index.js';
import { protectedProcedure, router } from '../trpc.js';

/**
 * Installation router — a THIN adapter over the installation services (the
 * composition axis: lines/cells). Read-only; writes belong to the management
 * surface when that lands. No logic lives here.
 */
export const installationRouter = router({
  get: protectedProcedure
    .input(GetInstallationInput)
    .query(({ ctx, input }) => getInstallation(ctx.service, input)),

  list: protectedProcedure
    .input(ListInstallationsInput)
    .query(({ ctx, input }) => listInstallations(ctx.service, input)),
});
