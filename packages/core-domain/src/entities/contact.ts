import { z } from 'zod';
import { ContactRole } from '../contact-role.js';
import { ContactId, CompanyId, SiteId, TenantId } from '../ids.js';
import { emptyToUndefined } from './_preprocess.js';

/**
 * A person at a customer (CRM contact). Belongs to a customer; optionally based at one
 * of that customer's sites (`siteId` null = a company-wide contact).
 */
export const Contact = z.object({
  id: ContactId,
  tenantId: TenantId,
  companyId: CompanyId,
  siteId: SiteId.nullable(),
  name: z.string().min(1).max(200),
  title: z.string().max(120).nullable(),
  role: ContactRole,
  email: z.string().email().max(320).nullable(),
  phone: z.string().max(40).nullable(),
  isPrimary: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Contact = z.infer<typeof Contact>;

/**
 * Write DTOs (management surface). Blank optional fields coerce `'' → undefined` via the
 * shared preprocessors (a blank form input is "absent", not an empty string), so the same
 * schema validates the client form and the server `parseInput`. `companyId` is set on
 * create and immutable after — a contact does not migrate between companies, as with
 * {@link Site}; `siteId` stays editable (a person can move between that customer's sites).
 */
export const ContactCreateInput = z.object({
  companyId: CompanyId,
  siteId: z.preprocess(emptyToUndefined, SiteId.optional()),
  name: z.string().min(1).max(200),
  title: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  role: ContactRole.default('other'),
  email: z.preprocess(
    emptyToUndefined,
    z.string().email('enter a valid email address').max(320).optional(),
  ),
  phone: z.preprocess(emptyToUndefined, z.string().max(40).optional()),
  isPrimary: z.boolean().default(false),
});
export type ContactCreateInput = z.infer<typeof ContactCreateInput>;

export const ContactUpdateInput = ContactCreateInput.omit({ companyId: true }).extend({
  id: ContactId,
});
export type ContactUpdateInput = z.infer<typeof ContactUpdateInput>;

export const ContactDeleteInput = z.object({ id: ContactId });
export type ContactDeleteInput = z.infer<typeof ContactDeleteInput>;
