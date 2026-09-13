import { z } from 'zod';
import { CompanyId, SiteId, TenantId } from '../ids.js';
import { emptyToUndefined } from './_preprocess.js';

/** A physical location belonging to a customer, where serials are installed. */
export const Site = z.object({
  id: SiteId,
  tenantId: TenantId,
  companyId: CompanyId,
  name: z.string().min(1).max(200),
  /** ISO 3166-1 alpha-2 country code, when known. */
  countryCode: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/)
    .optional(),
  /** IANA timezone (e.g. "Europe/Berlin"), when known. */
  timezone: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Site = z.infer<typeof Site>;

/**
 * Write DTOs (management surface). Explicit shapes omitting server-managed fields.
 * `companyId` is set on create and immutable thereafter — a site does not migrate
 * between companies (create a new one instead). See {@link Company} DTOs.
 */
export const SiteCreateInput = z.object({
  companyId: CompanyId,
  name: z.string().min(1).max(200),
  countryCode: z.preprocess(
    (value) => {
      const trimmed = emptyToUndefined(value);
      return typeof trimmed === 'string' ? trimmed.toUpperCase() : trimmed;
    },
    z
      .string()
      .regex(/^[A-Z]{2}$/, 'use a 2-letter country code, e.g. IT')
      .optional(),
  ),
  timezone: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
});
export type SiteCreateInput = z.infer<typeof SiteCreateInput>;

export const SiteUpdateInput = SiteCreateInput.omit({ companyId: true }).extend({ id: SiteId });
export type SiteUpdateInput = z.infer<typeof SiteUpdateInput>;

export const SiteDeleteInput = z.object({ id: SiteId });
export type SiteDeleteInput = z.infer<typeof SiteDeleteInput>;
