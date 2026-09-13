import { describe, expect, it } from 'vitest';
import { type PlatformPrincipal } from '@argoniq/auth';
import { type AuditEvent, type Logger } from '@argoniq/observability';
import { tenants } from '@argoniq/db';
import { type PlatformContext } from '../../platform-context.js';
import { createTenant, listTenants } from './index.js';

/**
 * Platform (super-admin) service tests. They exercise the real services over a
 * stubbed, NON-tenant-scoped db (the `tenants` table has no RLS), asserting that
 * onboarding validates input + audits, and that listing reads the tenant registry.
 * The cross-tenant authorization gate is structural (the `platformProcedure`
 * transport + the `PlatformContext` type), not a per-call check, so it is not
 * re-tested here.
 */
const principal: PlatformPrincipal = {
  kind: 'platform',
  userId: '00000000-0000-4000-8000-0000000d0000' as PlatformPrincipal['userId'],
};

function makeContext(rows: unknown[], events: AuditEvent[], created: unknown): PlatformContext {
  const db = {
    select: () => ({
      from: () => ({ orderBy: () => ({ limit: () => Promise.resolve(rows) }) }),
    }),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([created]) }) }),
  };
  const logger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
    child: () => logger,
  } as unknown as Logger;
  return {
    principal,
    db: db as unknown as PlatformContext['db'],
    auditor: { record: (event) => events.push(event) },
    logger,
  };
}

describe('platform services', () => {
  it('lists the tenant registry', async () => {
    const rows = [{ id: 't1', name: 'Acme' }];
    const result = await listTenants(makeContext(rows, [], null));
    expect(result).toEqual(rows);
    expect(tenants).toBeDefined();
  });

  it('onboards a manufacturer and audits it', async () => {
    const events: AuditEvent[] = [];
    const created = { id: 'new-tenant', name: 'Helios Robotics', slug: 'helios-robotics' };
    const row = await createTenant(makeContext([], events, created), {
      name: 'Helios Robotics',
      slug: 'helios-robotics',
    });
    expect(row).toEqual(created);
    expect(events).toContainEqual(
      expect.objectContaining({
        kind: 'access',
        action: 'tenant.created',
        subjectId: 'new-tenant',
      }),
    );
  });

  it('rejects an invalid slug at the validation edge', async () => {
    await expect(
      createTenant(makeContext([], [], null), { name: 'X', slug: 'Not A Slug' }),
    ).rejects.toThrowError();
  });
});
