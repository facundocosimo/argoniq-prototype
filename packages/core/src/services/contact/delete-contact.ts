import { eq } from 'drizzle-orm';
import { type ContactId, ContactDeleteInput } from '@argoniq/core-domain';
import { contacts } from '@argoniq/db';
import { NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

/**
 * Delete a contact. Contacts own no child rows, so this is an unconditional delete (no
 * reference-conflict path, unlike companies/sites); RLS scopes it to the tenant and a
 * missing row 404s.
 */
export async function deleteContact(
  ctx: ServiceContext,
  input: unknown,
): Promise<{ id: ContactId }> {
  const { id } = parseInput(ContactDeleteInput, input);
  ctx.policy.assertCan('delete', 'Contact', { id });

  await ctx.withTenant(async (tx) => {
    const [existing] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);
    if (!existing) throw new NotFoundError('contact', id);
    await tx.delete(contacts).where(eq(contacts.id, id));
  });

  ctx.auditor.record({
    kind: 'access',
    action: 'contact.deleted',
    subjectType: 'Contact',
    subjectId: id,
    decision: 'allow',
  });
  ctx.logger.info({ contactId: id }, 'contact deleted');
  return { id };
}
