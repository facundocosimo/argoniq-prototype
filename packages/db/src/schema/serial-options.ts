import {
  boolean,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { pk, tenantId, timestamps } from './_shared.js';
import { optionDefs } from './option-defs.js';
import { serials } from './serials.js';
import { tenants } from './tenants.js';

/**
 * Serial options — the configuration axis, selection (as-ordered) layer. One row
 * per (serial, optionDef): what this specific machine was built with. `present`
 * captures a boolean module; `chosenValue` captures the picked level of a
 * `choice`/`quantity` option. This is the commercial/as-ordered truth; the
 * physical as-built component tree (Phase 2) is a separate concern. Tenant-scoped
 * (RLS).
 */
export const serialOptions = pgTable(
  'serial_options',
  {
    id: pk(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    serialId: uuid('serial_id')
      .notNull()
      .references(() => serials.id, { onDelete: 'cascade' }),
    optionDefId: uuid('option_def_id')
      .notNull()
      .references(() => optionDefs.id, { onDelete: 'cascade' }),
    present: boolean('present').notNull().default(true),
    /** The picked level for a `choice`/`quantity` option; null for a boolean module. */
    chosenValue: varchar('chosen_value', { length: 200 }),
    installedAt: timestamp('installed_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('serial_options_tenant_idx').on(t.tenantId),
    index('serial_options_serial_idx').on(t.serialId),
    uniqueIndex('serial_options_serial_option_uq').on(t.serialId, t.optionDefId),
  ],
);

export type SerialOptionRow = typeof serialOptions.$inferSelect;
export type NewSerialOptionRow = typeof serialOptions.$inferInsert;
