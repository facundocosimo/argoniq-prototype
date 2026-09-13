import { eq } from 'drizzle-orm';
import { type InstallationId, InstallationDeleteInput } from '@argoniq/core-domain';
import { installations, serials } from '@argoniq/db';
import { NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { withReferenceConflict } from '../db-errors.js';

/**
 * Delete a line and explicitly detach its stations in one transaction. Documents
 * retain their scope: a document-bound line cannot be removed. A failed delete
 * rolls the station changes back as well.
 */
export async function deleteInstallation(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: InstallationId }> {
  const { id } = parseInput(InstallationDeleteInput, input);
  ctx.policy.assertCan('delete', 'Serial', { id });

  await withReferenceConflict(
    'This line has documents tied to it. Review their applicability before deleting the line.',
    () =>
      ctx.withTenant(async (tx) => {
        const [existing] = await tx
          .select({ id: installations.id })
          .from(installations)
          .where(eq(installations.id, id))
          .limit(1);
        if (!existing) throw new NotFoundError('installation', id);
        await tx
          .update(serials)
          .set({ installationId: null, position: null, updatedAt: new Date() })
          .where(eq(serials.installationId, id));
        await tx.delete(installations).where(eq(installations.id, id));
      }),
  );

  ctx.auditor.record({
    kind: 'access',
    action: 'installation.deleted',
    subjectType: 'Serial',
    subjectId: id,
    decision: 'allow',
  });
  ctx.logger.info({ installationId: id }, 'installation deleted');
  return { id };
}
