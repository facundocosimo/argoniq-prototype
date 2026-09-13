import { eq } from 'drizzle-orm';
import { ContactUpdateInput } from '@argoniq/core-domain';
import { type ContactRow, contacts } from '@argoniq/db';
import { InternalError, NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { assertSiteInCompany, clearPrimary } from './shared.js';

/**
 * Update a contact. `companyId` is immutable (not in the DTO), so the site re-check and
 * the primary-clear both key on the EXISTING row's customer. RLS scopes the row to the
 * tenant; a missing (or out-of-scope) row 404s before any write.
 */
export async function updateContact(ctx: ServiceContext, input: unknown): Promise<ContactRow> {
  const data = parseInput(ContactUpdateInput, input);
  ctx.policy.assertCan('update', 'Contact', { id: data.id });

  const row = await ctx.withTenant(async (tx) => {
    const [existing] = await tx.select().from(contacts).where(eq(contacts.id, data.id)).limit(1);
    if (!existing) throw new NotFoundError('contact', data.id);

    if (data.siteId) await assertSiteInCompany(tx, data.siteId, existing.companyId);
    if (data.isPrimary) await clearPrimary(tx, existing.companyId);

    const [updated] = await tx
      .update(contacts)
      .set({
        siteId: data.siteId ?? null,
        name: data.name,
        title: data.title ?? null,
        role: data.role,
        email: data.email ?? null,
        phone: data.phone ?? null,
        isPrimary: data.isPrimary,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, data.id))
      .returning();
    return updated;
  });
  if (!row) throw new InternalError('contact update returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'contact.updated',
    subjectType: 'Contact',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ contactId: row.id }, 'contact updated');
  return row;
}
