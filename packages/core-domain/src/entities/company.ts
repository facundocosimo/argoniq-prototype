import { z } from 'zod';
import { CompanyId, TenantId } from '../ids.js';

/** A customer organization within a tenant (OEM). Owns sites, contacts, and serials. */
export const Company = z.object({
  id: CompanyId,
  tenantId: TenantId,
  name: z.string().min(1).max(200),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Company = z.infer<typeof Company>;

/**
 * Write DTOs (the management surface). Explicit input shapes that omit server-managed
 * fields (id/tenantId/timestamps) — never the drizzle `$inferInsert` row, which would let
 * a client set tenant scope. The same schema validates on the client (`useZodForm`) and the
 * server (`parseInput`), so the two can never drift.
 */
export const CompanyCreateInput = Company.pick({ name: true });
export type CompanyCreateInput = z.infer<typeof CompanyCreateInput>;

export const CompanyUpdateInput = CompanyCreateInput.extend({ id: CompanyId });
export type CompanyUpdateInput = z.infer<typeof CompanyUpdateInput>;

export const CompanyDeleteInput = z.object({ id: CompanyId });
export type CompanyDeleteInput = z.infer<typeof CompanyDeleteInput>;
