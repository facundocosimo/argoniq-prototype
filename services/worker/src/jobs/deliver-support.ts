import { getEnv } from '@argoniq/core-domain/env';
import { type CaseDeliveryRepository } from '@argoniq/db';
import { type StoragePort } from '@argoniq/storage';
import {
  publicDestination,
  resolveSupportRoute,
  supportRoutes,
} from '@argoniq/notifications/support';
import { deliverSupportPacket, SupportDeliveryError } from '@argoniq/notifications/delivery';

/** The case row/outbox is durable; provider availability never gates intake. */
export async function deliverPendingSupport(
  repo: CaseDeliveryRepository,
  storage: StoragePort,
  deliver = deliverSupportPacket,
): Promise<void> {
  const env = getEnv();
  const routes = supportRoutes();
  for (const tenantId of await repo.tenantIds()) {
    for (const expired of await repo.expiredDrafts(tenantId))
      await repo.deleteExpiredDraft(tenantId, expired.id, (key) => storage.delete(key));
    for (let i = 0; i < 10; i++) {
      const work = await repo.claim(tenantId);
      if (!work) break;
      const { delivery, record, files } = work;
      try {
        if (!record.report || !record.destination)
          throw new SupportDeliveryError(
            'Request delivery data is incomplete. Contact your administrator.',
            false,
          );
        const route = resolveSupportRoute(tenantId, record.companyId, routes);
        if (publicDestination(route).version !== record.destination.version)
          throw new SupportDeliveryError(
            'Support routing changed. An administrator must reconcile the original destination.',
            false,
          );
        // Resend deduplicates for 24h. Stop before expiry, even after a worker outage.
        if (
          route.channel === 'email' &&
          delivery.attempts > 1 &&
          Date.now() - delivery.createdAt.getTime() > 23 * 60 * 60_000
        ) {
          await repo.finish(tenantId, delivery.id, delivery.claimToken!, {
            status: 'uncertain',
            error:
              'Email confirmation needs review. The automatic retry window expired; ask support to check the provider before resending.',
          });
          continue;
        }
        const externalId = await deliver(
          route,
          {
            id: record.id,
            tenantId,
            summary: record.summary,
            report: record.report,
            ...delivery.machineContext,
            files: await Promise.all(
              files.map(async (f) => ({
                id: f.id,
                filename: f.filename,
                contentType: f.contentType,
                bytes: await storage.get(f.storageKey),
              })),
            ),
          },
          {
            ...(env.SUPPORT_EMAIL_API_KEY ? { emailApiKey: env.SUPPORT_EMAIL_API_KEY } : {}),
            ...(env.SUPPORT_EMAIL_FROM ? { emailFrom: env.SUPPORT_EMAIL_FROM } : {}),
          },
        );
        await repo.finish(tenantId, delivery.id, delivery.claimToken!, {
          status: 'sent',
          externalId,
          sentAt: new Date(),
          error: null,
        });
      } catch (error) {
        const known = error instanceof SupportDeliveryError;
        const retry = (!known || error.retryable) && delivery.attempts < 5;
        await repo.finish(tenantId, delivery.id, delivery.claimToken!, {
          status: retry ? 'pending' : known && error.uncertain ? 'uncertain' : 'failed',
          error: known
            ? error.message
            : 'Delivery could not be confirmed. Contact support if this persists.',
          nextAttemptAt: new Date(Date.now() + 60_000 * 2 ** Math.min(delivery.attempts, 5)),
        });
      }
    }
  }
}
