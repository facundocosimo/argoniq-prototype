import { publicDestination, resolveSupportRoute } from '@argoniq/notifications/support';
import { SerialId } from '@argoniq/core-domain';
import { z } from 'zod';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { authorizedCaseMachine } from './attachments.js';
export const SupportDestinationInput = z.object({ serialId: SerialId });
export async function getSupportDestination(ctx: ServiceContext, input: unknown) {
  const { serialId } = parseInput(SupportDestinationInput, input);
  return ctx.withTenant(async (tx) => {
    const machine = await authorizedCaseMachine(ctx, tx, serialId);
    return publicDestination(resolveSupportRoute(ctx.tenantId, machine.companyId));
  });
}
