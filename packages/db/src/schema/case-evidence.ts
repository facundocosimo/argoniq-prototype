import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { pk, tenantId, timestamps } from './_shared.js';
import { cases } from './cases.js';
import { tenants } from './tenants.js';
import { serials } from './serials.js';

export const caseAttachments = pgTable(
  'case_attachments',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }),
    serialId: uuid('serial_id')
      .notNull()
      .references(() => serials.id, { onDelete: 'cascade' }),
    uploadedBy: uuid('uploaded_by').notNull(),
    submissionKey: uuid('submission_key').notNull(),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    storageKey: text('storage_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('case_attachments_case_idx').on(t.caseId),
    index('case_attachments_draft_idx').on(t.tenantId, t.submissionKey),
  ],
);

export const caseDeliveries = pgTable(
  'case_deliveries',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    status: text('status')
      .$type<'pending' | 'sending' | 'sent' | 'failed' | 'uncertain'>()
      .notNull()
      .default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    claimToken: uuid('claim_token'),
    externalId: text('external_id'),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    machineContext: jsonb('machine_context')
      .$type<{ serialNumber: string; companyName: string; siteName: string }>()
      .notNull(),
    attachmentExternalIds: jsonb('attachment_external_ids')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('case_deliveries_case_unique').on(t.caseId),
    index('case_deliveries_pending_idx').on(t.tenantId, t.status, t.nextAttemptAt),
  ],
);
