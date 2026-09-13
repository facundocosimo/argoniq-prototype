import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { SerialId } from '@argoniq/core-domain';
import { type SerialRow, serials } from '@argoniq/db';
import { NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

export const GetSerialInput = z.object({ serialId: SerialId });
export type GetSerialInput = z.infer<typeof GetSerialInput>;

/** Read one serial. validate → authorize → act → authorize (row scope) → audit. */
export async function getSerial(ctx: ServiceContext, input: unknown): Promise<SerialRow> {
  const { serialId } = parseInput(GetSerialInput, input);
  ctx.policy.assertCan('read', 'Serial');

  const [serial] = await ctx.withTenant(async (tx) =>
    tx.select().from(serials).where(eq(serials.id, serialId)).limit(1),
  );
  if (!serial) throw new NotFoundError('serial', serialId);

  // Row-level scope check (companies may only read their own serials).
  ctx.policy.assertCan('read', 'Serial', { id: serial.id, companyId: serial.companyId });
  return serial;
}
