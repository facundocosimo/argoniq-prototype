import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ContactId } from '@argoniq/core-domain';
import { type ContactRow, contacts } from '@argoniq/db';
import { NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

export const GetContactInput = z.object({ contactId: ContactId });
export type GetContactInput = z.infer<typeof GetContactInput>;

/** Read one contact (management edit page). Validate → authorize → act. */
export async function getContact(ctx: ServiceContext, input: unknown): Promise<ContactRow> {
  const { contactId } = parseInput(GetContactInput, input);
  ctx.policy.assertCan('read', 'Contact');
  const [row] = await ctx.withTenant((tx) =>
    tx.select().from(contacts).where(eq(contacts.id, contactId)).limit(1),
  );
  if (!row) throw new NotFoundError('contact', contactId);
  return row;
}
