import { ContactCreateInput } from '@argoniq/core-domain';
import { type ContactRow, contacts } from '@argoniq/db';
import { InternalError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { assertCompanyExists, assertSiteInCompany, clearPrimary } from './shared.js';

/**
 * Create a contact under a customer. The parent customer must resolve in-tenant, and a
 * chosen site must belong to that customer (both surface as clean 404s, not FK errors).
 * Marking the contact primary first clears any existing primary for the customer.
 * validate → authorize → act → audit; policy-gated (OEM-staff authoring only).
 */
export async function createContact(ctx: ServiceContext, input: unknown): Promise<ContactRow> {
  const data = parseInput(ContactCreateInput, input);
  ctx.policy.assertCan('create', 'Contact', { companyId: data.companyId });

  const row = await ctx.withTenant(async (tx) => {
    await assertCompanyExists(tx, data.companyId);
    if (data.siteId) await assertSiteInCompany(tx, data.siteId, data.companyId);
    if (data.isPrimary) await clearPrimary(tx, data.companyId);

    const [created] = await tx
      .insert(contacts)
      .values({
        tenantId: ctx.tenantId,
        companyId: data.companyId,
        siteId: data.siteId ?? null,
        name: data.name,
        title: data.title ?? null,
        role: data.role,
        email: data.email ?? null,
        phone: data.phone ?? null,
        isPrimary: data.isPrimary,
      })
      .returning();
    return created;
  });
  if (!row) throw new InternalError('contact insert returned no row');

  ctx.auditor.record({
    kind: 'access',
    action: 'contact.created',
    subjectType: 'Contact',
    subjectId: row.id,
    decision: 'allow',
  });
  ctx.logger.info({ contactId: row.id, companyId: row.companyId }, 'contact created');
  return row;
}
