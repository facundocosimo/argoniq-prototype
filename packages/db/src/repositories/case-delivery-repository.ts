import { randomUUID } from 'node:crypto';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { TenantId } from '@argoniq/core-domain';
import { type Database } from '../client.js';
import { withTenant } from '../tenant-scope.js';
import { caseAttachments, caseDeliveries, cases, tenants } from '../schema/index.js';

export class CaseDeliveryRepository {
  constructor(private readonly db: Database) {}
  async tenantIds() {
    return (await this.db.select({ id: tenants.id }).from(tenants)).map((t) =>
      TenantId.parse(t.id),
    );
  }
  async claim(tenantId: TenantId) {
    return withTenant(this.db, tenantId, async (tx) => {
      await tx
        .update(caseDeliveries)
        .set({ status: 'pending', claimToken: null })
        .where(
          and(
            eq(caseDeliveries.status, 'sending'),
            lt(caseDeliveries.updatedAt, new Date(Date.now() - 10 * 60_000)),
          ),
        );
      const [candidate] = await tx
        .select()
        .from(caseDeliveries)
        .where(
          and(eq(caseDeliveries.status, 'pending'), lt(caseDeliveries.nextAttemptAt, new Date())),
        )
        .limit(1)
        .for('update', { skipLocked: true });
      if (!candidate) return null;
      const token = randomUUID();
      const [delivery] = await tx
        .update(caseDeliveries)
        .set({
          status: 'sending',
          claimToken: token,
          attempts: sql`${caseDeliveries.attempts}+1`,
          updatedAt: new Date(),
        })
        .where(eq(caseDeliveries.id, candidate.id))
        .returning();
      const [record] = await tx.select().from(cases).where(eq(cases.id, candidate.caseId));
      const files = await tx
        .select()
        .from(caseAttachments)
        .where(eq(caseAttachments.caseId, candidate.caseId))
        .orderBy(caseAttachments.id);
      return { delivery: delivery!, record: record!, files };
    });
  }
  async finish(
    tenantId: TenantId,
    id: string,
    token: string,
    patch: Partial<
      Pick<
        typeof caseDeliveries.$inferInsert,
        'status' | 'error' | 'externalId' | 'sentAt' | 'nextAttemptAt'
      >
    >,
  ) {
    await withTenant(this.db, tenantId, async (tx) => {
      await tx
        .update(caseDeliveries)
        .set({ ...patch, claimToken: null, updatedAt: new Date() })
        .where(and(eq(caseDeliveries.id, id), eq(caseDeliveries.claimToken, token)));
    });
  }
  async expiredDrafts(tenantId: TenantId) {
    return withTenant(this.db, tenantId, async (tx) =>
      tx
        .select({ id: caseAttachments.id, storageKey: caseAttachments.storageKey })
        .from(caseAttachments)
        .where(
          and(
            isNull(caseAttachments.caseId),
            lt(caseAttachments.createdAt, new Date(Date.now() - 24 * 60 * 60_000)),
          ),
        ),
    );
  }
  async deleteExpiredDraft(
    tenantId: TenantId,
    id: string,
    deleteObject: (key: string) => Promise<void>,
  ) {
    await withTenant(this.db, tenantId, async (tx) => {
      const [before] = await tx.select().from(caseAttachments).where(eq(caseAttachments.id, id));
      if (!before) return;
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${tenantId + ':' + before.submissionKey},0))`,
      );
      const [row] = await tx
        .select()
        .from(caseAttachments)
        .where(
          and(
            eq(caseAttachments.id, id),
            isNull(caseAttachments.caseId),
            lt(caseAttachments.createdAt, new Date(Date.now() - 24 * 60 * 60_000)),
          ),
        )
        .for('update');
      if (!row) return;
      await deleteObject(row.storageKey);
      await tx.delete(caseAttachments).where(eq(caseAttachments.id, id));
    });
  }
}
