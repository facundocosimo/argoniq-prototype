'use client';
import { SUPPORT_IMPACT_LABEL } from '@argoniq/core-domain';
import { Button } from '@argoniq/ui';
import { trpc } from '../lib/trpc/client.js';

export function CaseReceipt({ caseId, canRetry = false }: { caseId: string; canRetry?: boolean }) {
  const query = trpc.case.get.useQuery(
    { caseId },
    {
      refetchInterval: (q) =>
        ['pending', 'sending'].includes(q.state.data?.delivery?.status ?? '') ? 5000 : false,
    },
  );
  const retry = trpc.case.retryDelivery.useMutation({
    onSuccess: () => {
      void query.refetch();
    },
  });
  const record = query.data;
  if (!record?.report || !record.destination) return null;
  const delivery = record.delivery;
  const status = delivery?.status;
  const message =
    status === 'sent'
      ? record.destination.channel === 'email'
        ? 'Accepted by the email provider. Inbox delivery and reading are not confirmed.'
        : record.destination.channel === 'servicemax'
          ? 'Request and attachments handed to ServiceMax.'
          : 'Available in the manufacturer’s support inbox.'
      : status === 'failed'
        ? 'Your request is saved, but the handoff is incomplete. Some items may already be available to support. Contact the team and quote this reference.'
        : status === 'uncertain'
          ? 'Your request is saved. Delivery needs verification before another send.'
          : 'Your request is saved. Delivery is queued; you can leave this page.';
  return (
    <div className="space-y-6">
      <section className="border-border rounded-md border p-4" aria-label="Request receipt">
        <h2 className="text-base font-semibold">Request received</h2>
        <p className="mt-2 text-sm" role="status">
          {message}
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Item label="Destination" value={record.destination.label} />
          <Item
            label="Channel"
            value={
              record.destination.channel === 'inbox'
                ? 'Support inbox'
                : record.destination.channel === 'email'
                  ? 'Email'
                  : 'ServiceMax'
            }
          />
          <Item label="Submitted" value={new Date(record.createdAt).toLocaleString()} />
          <Item
            label="Preferred reply"
            value={`${record.report.contactPreference === 'phone' ? 'Phone' : 'Email'} · ${record.report.contactPreference === 'phone' ? record.report.contactPhone : record.report.contactEmail}`}
          />
        </dl>
        <p className="text-text-muted mt-3 text-xs">
          A response time has not been confirmed.{' '}
          {record.destination.channel !== 'inbox'
            ? 'This page records the handoff; external replies and work-order status are not synchronized.'
            : ''}
        </p>
        {canRetry && status === 'failed' ? (
          <div className="mt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={retry.isPending}
              onClick={() => retry.mutate({ caseId })}
            >
              {retry.isPending ? 'Queueing…' : 'Retry delivery'}
            </Button>
            <p className="text-text-muted mt-2 text-xs">
              Fix the delivery configuration before retrying.
            </p>
            {retry.error ? (
              <p role="alert" className="text-danger mt-2 text-sm">
                {retry.error.message}
              </p>
            ) : null}
          </div>
        ) : null}
        {query.error ? (
          <p className="text-danger mt-2 text-sm">
            Delivery status could not be refreshed. Reload this page to check again.
          </p>
        ) : null}
      </section>
      <section aria-label="Reported details">
        <h2 className="mb-4 text-base font-semibold">Reported details</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Item label="Impact" value={SUPPORT_IMPACT_LABEL[record.report.impact]} />
          <Item
            label="Safety concern"
            value={
              record.report.safetyConcern === 'yes'
                ? 'Reported'
                : record.report.safetyConcern === 'no'
                  ? 'None reported'
                  : 'Not sure'
            }
          />
          <Item label="Alarm" value={record.report.alarmCode || 'Not known'} />
          <Item label="When it started" value={record.report.startedAt || 'Not known'} />
          <Item
            label="Contact"
            value={`${record.report.contactName} · ${record.report.contactEmail}`}
          />
        </dl>
        {record.report.observations ? (
          <p className="mt-4 text-sm break-words whitespace-pre-wrap">
            {record.report.observations}
          </p>
        ) : null}
      </section>
      {record.report.sourceReferences?.length ? (
        <section aria-label="References from chat">
          <h2 className="mb-3 text-base font-semibold">References from chat</h2>
          <ul className="space-y-2">
            {record.report.sourceReferences.map((source) => (
              <li key={`${source.documentId}:${source.page ?? ''}`}>
                <a
                  className="text-accent text-sm hover:underline"
                  href={`/technical-information/${source.documentId}${source.page ? `?page=${source.page}` : ''}`}
                >
                  {source.title}
                  {source.page ? ` · Page ${source.page}` : ''}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-label="Shared attachments">
        <h2 className="mb-3 text-base font-semibold">Shared attachments</h2>
        {record.attachments.length ? (
          <ul className="space-y-2">
            {record.attachments.map((file) => (
              <li key={file.id}>
                <a
                  className="text-accent text-sm break-all hover:underline"
                  href={`/api/cases/attachments/${file.id}`}
                >
                  {file.filename}
                </a>
                <span className="text-text-muted ml-2 text-xs">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-muted text-sm">No attachments.</p>
        )}
      </section>
    </div>
  );
}
function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-text-muted text-xs">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}
