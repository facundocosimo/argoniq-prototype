import { eq } from 'drizzle-orm';
import { type SerialId, SerialDeleteInput } from '@argoniq/core-domain';
import { serials } from '@argoniq/db';
import { NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { withReferenceConflict } from '../db-errors.js';

/** Delete an installed machine. A serial with cases/documents bound to it cannot
 *  be removed — surfaced as a clean conflict rather than an opaque FK failure. */
export async function deleteSerial(ctx: ServiceContext, input: unknown): Promise<{ id: SerialId }> {
  const { id } = parseInput(SerialDeleteInput, input);
  ctx.policy.assertCan('delete', 'Serial', { id });

  await withReferenceConflict('This machine has support history and cannot be deleted.', () =>
    ctx.withTenant(async (tx) => {
      const [existing] = await tx.select().from(serials).where(eq(serials.id, id)).limit(1);
      if (!existing) throw new NotFoundError('serial', id);
      await tx.delete(serials).where(eq(serials.id, id));
    }),
  );

  ctx.auditor.record({
    kind: 'access',
    action: 'serial.deleted',
    subjectType: 'Serial',
    subjectId: id,
    decision: 'allow',
  });
  ctx.logger.info({ serialId: id }, 'serial deleted');
  return { id };
}
