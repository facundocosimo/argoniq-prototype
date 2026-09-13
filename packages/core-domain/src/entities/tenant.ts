import { z } from 'zod';
import { TenantId } from '../ids.js';

/**
 * A tenant is an OEM. It is the top of the isolation hierarchy: every row,
 * document, and event is tenant-scoped, enforced at the data layer by RLS
 *. White-label branding is a token override (`brandAccentColor`),
 * never a code fork.
 */
export const Tenant = z.object({
  id: TenantId,
  slug: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'slug must be url-safe (lowercase, digits, hyphens)'),
  name: z.string().min(1).max(200),
  /** Single OEM-brand accent token; the rest of the palette derives from it. */
  brandAccentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'must be a 6-digit hex color')
    .optional(),
  /** Data residency region (EU-preferred, pragmatic). */
  region: z.string().min(1).default('eu-central-1'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Tenant = z.infer<typeof Tenant>;

/**
 * Onboarding DTO (platform surface) — the fields a platform operator supplies to
 * register a new Manufacturer. Server-managed fields (id/timestamps) are omitted.
 * Only the platform layer may create tenants; there is no tenant-scoped path to it.
 */
export const TenantCreateInput = Tenant.pick({ name: true, slug: true }).extend({
  region: z.string().min(1).max(64).optional(),
  brandAccentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'must be a 6-digit hex color')
    .optional(),
});
export type TenantCreateInput = z.infer<typeof TenantCreateInput>;
