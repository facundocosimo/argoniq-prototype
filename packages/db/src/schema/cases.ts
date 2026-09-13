import { type SupportReport, type SupportDestination } from '@argoniq/core-domain';
import {
  boolean,
  uniqueIndex,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  answerModeEnum,
  confidenceBandEnum,
  pk,
  safetyZoneEnum,
  tenantId,
  caseStatusEnum,
  timestamps,
} from './_shared.js';
import { companies } from './companies.js';
import { serials } from './serials.js';
import { sites } from './sites.js';
import { symptoms } from './symptoms.js';
import { tenants } from './tenants.js';

/** A ranked cause as captured on a serviceCase (staff-facing). */
export type CaseRankedCause = {
  key: string;
  label: string;
  confidence: number;
  rationale?: string;
};

/**
 * Support cases. `summary` is customer-facing; `internalNote`, `rankedCauses`,
 * and confidence are staff-facing. Tenant-scoped by RLS.
 */
export const cases = pgTable(
  'cases',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'restrict' }),
    serialId: uuid('serial_id').references(() => serials.id, { onDelete: 'set null' }),
    symptomId: uuid('symptom_id').references(() => symptoms.id, { onDelete: 'set null' }),
    status: caseStatusEnum('status').notNull().default('open'),
    /** Customer-facing plain-language summary. */
    summary: text('summary').notNull(),
    submissionKey: uuid('submission_key'),
    submittedBy: uuid('submitted_by'),
    submissionHash: text('submission_hash'),
    report: jsonb('report').$type<SupportReport>(),
    destination: jsonb('destination').$type<SupportDestination>(),
    /** Staff-facing reasoning; may reflect T3. Never shown to a customer. */
    internalNote: text('internal_note'),
    rankedCauses: jsonb('ranked_causes').$type<CaseRankedCause[]>().notNull().default([]),
    suggestedPartIds: jsonb('suggested_part_ids').$type<string[]>().notNull().default([]),
    answerMode: answerModeEnum('answer_mode'),
    safetyZone: safetyZoneEnum('safety_zone'),
    confidence: confidenceBandEnum('confidence'),
    aiAssisted: boolean('ai_assisted').notNull().default(false),
    /** Resolution details: confirmed root-cause key and part used. */
    confirmedRootCauseKey: varchar('confirmed_root_cause_key', { length: 100 }),
    partUsedId: uuid('part_used_id'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('cases_submission_key_unique').on(t.tenantId, t.submissionKey),
    index('cases_tenant_idx').on(t.tenantId),
    index('cases_tenant_status_idx').on(t.tenantId, t.status),
    index('cases_serial_idx').on(t.serialId),
  ],
);

export type CaseRow = typeof cases.$inferSelect;
export type NewCaseRow = typeof cases.$inferInsert;
