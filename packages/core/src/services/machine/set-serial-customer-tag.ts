import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { SerialId } from '@argoniq/core-domain';
import { type SerialRow, serials } from '@argoniq/db';
import { InternalError, NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

export const SetSerialCustomerTagInput = z.object({
  serialId: SerialId,
  /** The client's factory tag (e.g. "ATLAS-001"); an empty string clears it. */
  tag: z.string().trim().max(100),
});
export type SetSerialCustomerTagInput = z.infer<typeof SetSerialCustomerTagInput>;

/**
 * Set (or clear) a machine's customer-assigned factory tag — the client's own label
 * for the machine, distinct from the OEM serial number. Authorization is bound to the
 * serial's OWN customer, so a client may tag only their own machines; OEM management
 * authority (manage-all) also passes. RLS bounds the read to the tenant; the explicit
 * `companyId` check on the fetched row bounds the write to the machine's owner — the
 * within-tenant customer scoping that RLS (tenant-level) does not enforce.
 */
export async function setSerialCustomerTag(
  ctx: ServiceContext,
  input: unknown,
): Promise<SerialRow> {
  const { serialId, tag } = parseInput(SetSerialCustomerTagInput, input);

  const row = await ctx.withTenant(async (tx) => {
    const [existing] = await tx.select().from(serials).where(eq(serials.id, serialId)).limit(1);
    if (!existing) throw new NotFoundError('serial', serialId);
    // Bound to the machine's owner: a client tags only their own machines; OEM
    // manage-all passes. (Denial throws before any row data is returned.)
    ctx.policy.assertCan('update', 'Serial', { id: existing.id, companyId: existing.companyId });

    const [updated] = await tx
      .update(serials)
      .set({ customerTag: tag === '' ? null : tag, updatedAt: new Date() })
      .where(eq(serials.id, serialId))
      .returning();
    return updated;
  });
  if (!row) throw new InternalError('serial tag update returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'serial.tagged',
    subjectType: 'Serial',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ serialId: row.id }, 'serial customer tag updated');
  return row;
}
