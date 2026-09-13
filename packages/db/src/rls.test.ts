import { getTableColumns, getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import * as schema from './schema/index.js';
import { TENANT_SCOPED_TABLES, applyKnowledgeTierIsolation } from './rls.js';

/**
 * Intentional exclusions from tenant RLS, with the reason. `audit_log` is
 * append-only, system-written, with a nullable tenant; its reads are gated in
 * the service layer (see rls.ts).
 */
const RLS_EXEMPT = new Set(['audit_log']);

const schemaTablesWithTenantColumn = (Object.values(schema) as unknown[])
  .filter((value): value is PgTable => is(value, PgTable))
  .filter((table) => 'tenantId' in getTableColumns(table))
  .map((table) => getTableName(table));

describe('RLS coverage ( gate 3 — cross-tenant isolation)', () => {
  it('every table with a tenant_id column has an RLS policy or a documented exemption', () => {
    for (const name of schemaTablesWithTenantColumn) {
      if (RLS_EXEMPT.has(name)) continue;
      expect(
        TENANT_SCOPED_TABLES as readonly string[],
        `table "${name}" has a tenant_id column but is missing from TENANT_SCOPED_TABLES`,
      ).toContain(name);
    }
  });

  it('lists only real tables (no typos in the RLS allowlist)', () => {
    const realNames = new Set([...schemaTablesWithTenantColumn, ...RLS_EXEMPT]);
    for (const name of TENANT_SCOPED_TABLES) {
      expect(realNames).toContain(name);
    }
  });
});

/** A client that records the raw SQL issued, so policy DDL is asserted without a DB. */
function recordingClient(): { client: Sql; statements: string[] } {
  const statements: string[] = [];
  const client = {
    unsafe: (statement: string) => {
      statements.push(statement);
      return Promise.resolve();
    },
  } as unknown as Sql;
  return { client, statements };
}

describe('T4 credential isolation (the answer role cannot read T4)', () => {
  it('applies a RESTRICTIVE no-T4 policy scoped to the app role on document_chunks', async () => {
    const { client, statements } = recordingClient();
    await applyKnowledgeTierIsolation(client, 'argoniq_app');

    const create = statements.find((s) => s.includes('CREATE POLICY answer_role_no_t4'));
    expect(create).toBeDefined();
    expect(create).toContain('ON document_chunks');
    expect(create).toContain('AS RESTRICTIVE');
    // Scoped to the app role only — the owner (seed/migration) still manages T4.
    expect(create).toContain('TO "argoniq_app"');
    expect(create).toMatch(/tier <> 'T4'/);
    // Idempotent: drops the prior policy first.
    expect(statements.some((s) => s.includes('DROP POLICY IF EXISTS answer_role_no_t4'))).toBe(
      true,
    );
  });

  it('safely quotes a role identifier (no injection via the role name)', async () => {
    const { client, statements } = recordingClient();
    await applyKnowledgeTierIsolation(client, 'we"ird');
    const create = statements.find((s) => s.includes('CREATE POLICY'));
    expect(create).toContain('TO "we""ird"');
  });
});
