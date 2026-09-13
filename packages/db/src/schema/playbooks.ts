import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { type PlaybookCause, type PlaybookStep } from '@argoniq/core-domain';
import { pk, tenantId, timestamps } from './_shared.js';
import { machineFamilies } from './machine-families.js';
import { machineModels } from './machine-models.js';
import { symptoms } from './symptoms.js';
import { tenants } from './tenants.js';

export const playbookStatusEnum = pgEnum('playbook_status', [
  'draft',
  'in_review',
  'published',
  'deprecated',
]);

/**
 * Playbooks — the unit of accumulated IP. Candidate causes and steps are
 * stored as JSONB (config-as-data, editable without redeploy). `linkedDocumentIds`
 * holds DocumentId references loosely (no FK, since a playbook may outlive a doc
 * version). Sign-off columns record the two-person review required for safety
 * steps. Tenant-scoped (RLS).
 */
export const playbooks = pgTable(
  'playbooks',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id')
      .notNull()
      .references(() => machineFamilies.id, { onDelete: 'cascade' }),
    modelId: uuid('model_id').references(() => machineModels.id, { onDelete: 'set null' }),
    symptomId: uuid('symptom_id')
      .notNull()
      .references(() => symptoms.id, { onDelete: 'restrict' }),
    key: varchar('key', { length: 100 }).notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    status: playbookStatusEnum('status').notNull().default('draft'),
    version: integer('version').notNull().default(1),
    candidateCauses: jsonb('candidate_causes').$type<PlaybookCause[]>().notNull().default([]),
    steps: jsonb('steps').$type<PlaybookStep[]>().notNull().default([]),
    linkedDocumentIds: jsonb('linked_document_ids').$type<string[]>().notNull().default([]),
    authoredByUserId: uuid('authored_by_user_id'),
    approvedByUserId: uuid('approved_by_user_id'),
    safetyReviewedByUserId: uuid('safety_reviewed_by_user_id'),
    ...timestamps(),
  },
  (t) => [
    index('playbooks_tenant_idx').on(t.tenantId),
    index('playbooks_symptom_idx').on(t.symptomId),
    uniqueIndex('playbooks_tenant_key_version_uq').on(t.tenantId, t.key, t.version),
  ],
);

export type PlaybookRow = typeof playbooks.$inferSelect;
export type NewPlaybookRow = typeof playbooks.$inferInsert;
