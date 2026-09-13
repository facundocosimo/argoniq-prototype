import { eq } from 'drizzle-orm';
import { AssignSerialInput } from '@argoniq/core-domain';
import { installations, type SerialRow, serials } from '@argoniq/db';
import { InternalError, NotFoundError, ValidationError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { withReferenceConflict } from '../db-errors.js';

/**
 * Assign a serial to a line (or detach it) and set its flow position + OEM-of-record.
 * A line and its stations must belong to the same customer — a station cannot be
 * grouped under another customer's line. Detaching (`installationId: null`) makes the
 * machine standalone again and clears its position.
 */
export async function assignSerial(ctx: ServiceContext, input: unknown): Promise<SerialRow> {
  const data = parseInput(AssignSerialInput, input);
  ctx.policy.assertCan('update', 'Serial', { id: data.serialId });

  const row = await withReferenceConflict(
    'This machine has documents tied to its current line. Review their applicability before moving it.',
    () =>
      ctx.withTenant(async (tx) => {
        const [existing] = await tx
          .select()
          .from(serials)
          .where(eq(serials.id, data.serialId))
          .limit(1);
        if (!existing) throw new NotFoundError('serial', data.serialId);

        if (data.installationId) {
          const [installation] = await tx
            .select({ id: installations.id, companyId: installations.companyId })
            .from(installations)
            .where(eq(installations.id, data.installationId))
            .limit(1);
          if (!installation) throw new NotFoundError('installation', data.installationId);
          if (installation.companyId !== existing.companyId) {
            throw new ValidationError('That line belongs to a different company.');
          }
        }

        const [updated] = await tx
          .update(serials)
          .set({
            installationId: data.installationId,
            // Position only makes sense inside a line; clear it when detaching.
            position: data.installationId ? data.position : null,
            manufacturer: data.manufacturer,
            updatedAt: new Date(),
          })
          .where(eq(serials.id, data.serialId))
          .returning();
        return updated;
      }),
  );
  if (!row) throw new InternalError('serial assignment returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'serial.assigned',
    subjectType: 'Serial',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info(
    { serialId: row.id, installationId: row.installationId, position: row.position },
    'serial assignment updated',
  );
  return row;
}
