import { eq } from 'drizzle-orm';
import { type CompanyId, CompanyDeleteInput } from '@argoniq/core-domain';
import { companies } from '@argoniq/db';
import { NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { withReferenceConflict } from '../db-errors.js';

/**
 * Delete a company only when its machines, lines and documents no longer reference
 * it. Surface the database's protected-reference conflict without deleting history.
 */
export async function deleteCompany(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: CompanyId }> {
  const { id } = parseInput(CompanyDeleteInput, input);
  ctx.policy.assertCan('delete', 'Company', { id });

  await withReferenceConflict(
    'This company has linked machines, lines or documents and cannot be deleted.',
    () =>
      ctx.withTenant(async (tx) => {
        const [existing] = await tx.select().from(companies).where(eq(companies.id, id)).limit(1);
        if (!existing) throw new NotFoundError('company', id);
        await tx.delete(companies).where(eq(companies.id, id));
      }),
  );

  ctx.auditor.record({
    kind: 'access',
    action: 'company.deleted',
    subjectType: 'Company',
    subjectId: id,
    decision: 'allow',
  });
  ctx.logger.info({ companyId: id }, 'company deleted');
  return { id };
}
