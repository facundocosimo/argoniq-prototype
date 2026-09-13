import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { pgEnum } from 'drizzle-orm/pg-core';
import { pk } from './_shared.js';

export const auditKindEnum = pgEnum('audit_kind', ['access', 'ai_decision', 'safety']);

/**
 * Append-only audit log  — the durable, immutable record behind
 * the `Auditor`. No `updatedAt`: rows are never modified. `tenantId` is nullable
 * because a few pre-tenant-resolution events (e.g. failed auth) are still
 * auditable. Indexed by tenant and correlation id for reconstruction.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: pk(),
    tenantId: uuid('tenant_id'),
    correlationId: varchar('correlation_id', { length: 64 }),
    userId: uuid('user_id'),
    kind: auditKindEnum('kind').notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_tenant_idx').on(t.tenantId),
    index('audit_log_correlation_idx').on(t.correlationId),
    index('audit_log_kind_idx').on(t.kind),
  ],
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
