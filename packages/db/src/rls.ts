import type { Sql } from 'postgres';

/**
 * The tenant isolation security artifact, applied programmatically so
 * it lives in one reviewable place rather than scattered across generated
 * migrations. Every table here gets RLS ENABLED + FORCED and a `tenant_isolation`
 * policy keyed on the `app.tenant_id` GUC. Idempotent (drop-then-create), so it
 * is safe to re-run on every migrate.
 *
 * `audit_log` is intentionally excluded: it is append-only and written under
 * elevated/system context with a nullable tenant; its reads are gated in the
 * service layer.
 */
export const TENANT_SCOPED_TABLES = [
  'companies',
  'sites',
  'contacts',
  'machine_families',
  'machine_models',
  'variant_axes',
  'installations',
  'serials',
  'option_defs',
  'serial_options',
  'option_constraints',
  'documents',
  'document_chunks',
  'document_scopes',
  'symptoms',
  'playbooks',
  'cases',
  'case_attachments',
  'case_deliveries',
  'memberships',
] as const;

const TENANT_PREDICATE = `tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid`;

export async function applyRlsPolicies(client: Sql): Promise<void> {
  for (const table of TENANT_SCOPED_TABLES) {
    await client.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    await client.unsafe(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
    await client.unsafe(`DROP POLICY IF EXISTS tenant_isolation ON ${table};`);
    await client.unsafe(
      `CREATE POLICY tenant_isolation ON ${table} ` +
        `USING (${TENANT_PREDICATE}) WITH CHECK (${TENANT_PREDICATE});`,
    );
  }
  await client.unsafe(`DROP POLICY IF EXISTS identity_membership_read ON memberships;`);
  await client.unsafe(
    `CREATE POLICY identity_membership_read ON memberships FOR SELECT ` +
      `USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid);`,
  );
}

/** Enable pgvector. Must run before migrations that create `vector` columns. */
export async function applyVectorExtension(client: Sql): Promise<void> {
  await client.unsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
}

/** Quote a SQL identifier (e.g. a role name) safely — doubles embedded quotes. */
function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * T4 credential isolation. A RESTRICTIVE RLS policy that
 * AND-s `tier <> 'T4'` onto everything the least-privilege APPLICATION role does on
 * `document_chunks`. Combined with the permissive `tenant_isolation` policy, the app
 * role — the answer service's credential — is STRUCTURALLY unable to read (or write)
 * T4 chunks: not by a query predicate a future change could drop, but at the database.
 *
 * The policy targets ONLY the app role, so the schema-owner role (seed + migration)
 * still manages T4, and a future T4-credentialed reader uses a different role. This is
 * the credential isolation  requires: the answer service cannot reach T4 at all.
 * Idempotent (drop-then-create). Applied only when a distinct app role exists.
 */
export async function applyKnowledgeTierIsolation(client: Sql, appRole: string): Promise<void> {
  const role = quoteIdent(appRole);
  await client.unsafe(`DROP POLICY IF EXISTS answer_role_no_t4 ON document_chunks;`);
  await client.unsafe(
    `CREATE POLICY answer_role_no_t4 ON document_chunks AS RESTRICTIVE TO ${role} ` +
      `USING (tier <> 'T4') WITH CHECK (tier <> 'T4');`,
  );
}

/** Hybrid-retrieval indexes : HNSW for vectors, GIN for BM25/FTS. */
export async function applySearchIndexes(client: Sql): Promise<void> {
  await client.unsafe(
    `CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw ` +
      `ON document_chunks USING hnsw (embedding vector_cosine_ops);`,
  );
  await client.unsafe(
    `CREATE INDEX IF NOT EXISTS document_chunks_content_fts ` +
      `ON document_chunks USING gin (to_tsvector('english', content));`,
  );
}
