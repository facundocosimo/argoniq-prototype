import { TenantCreateInput } from '@argoniq/core-domain';
import { createTenant, listTenants } from '../../../services/index.js';
import { platformProcedure, router } from '../trpc.js';

/**
 * Platform router — the super-admin surface, ABOVE tenants. Every procedure is a
 * `platformProcedure`, so a tenant/customer principal is structurally locked out.
 * A THIN adapter over the platform services; onboarding a tenant is the only write.
 * Entering an OEM (impersonation) is a SESSION change handled at the web layer, not
 * a data mutation, so it lives with the app's route handlers — not here.
 */
export const platformRouter = router({
  listTenants: platformProcedure.query(({ ctx }) => listTenants(ctx.platform)),
  createTenant: platformProcedure
    .input(TenantCreateInput)
    .mutation(({ ctx, input }) => createTenant(ctx.platform, input)),
});
