import { z } from 'zod';
import { type SupportReport, SUPPORT_IMPACT_LABEL } from '@argoniq/core-domain';
import { type SupportRoute } from './support-routing.js';

export interface SupportPacket {
  id: string;
  tenantId: string;
  summary: string;
  serialNumber: string;
  companyName: string;
  siteName: string;
  report: SupportReport;
  files: { id: string; filename: string; contentType: string; bytes: Uint8Array }[];
}
export class SupportDeliveryError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly uncertain = false,
  ) {
    super(message);
  }
}
const remoteId = z.string().regex(/^[A-Za-z0-9]{15}([A-Za-z0-9]{3})?$/);
export function supportPacketText(packet: SupportPacket): string {
  const r = packet.report;
  return [
    `Request: CASE-${packet.id.slice(0, 8).toUpperCase()}`,
    `ArgonIQ ID: ${packet.id}`,
    `Machine: ${packet.serialNumber}`,
    `Company: ${packet.companyName}`,
    `Site: ${packet.siteName}`,
    `Contact: ${r.contactName} <${r.contactEmail}>`,
    `Phone: ${r.contactPhone || 'Not provided'}`,
    `Contact preference: ${r.contactPreference}`,
    `Reported impact: ${SUPPORT_IMPACT_LABEL[r.impact]}`,
    `Reported safety concern: ${r.safetyConcern}`,
    `Alarm: ${r.alarmCode || 'Not known'}`,
    `Started: ${r.startedAt || 'Not known'}`,
    `Observations: ${r.observations || 'Not provided'}`,
    '',
    packet.summary,
    '',
    `Attachments: ${packet.files.map((f) => f.filename).join(', ') || 'None'}`,
    ...(r.sourceReferences ?? []).map(
      (source) =>
        `Reference consulted: ${source.title}${source.page ? `, page ${source.page}` : ''}`,
    ),
    r.preparedFromChat
      ? 'Prepared from chat and reviewed/confirmed by the requester. References do not confirm a cause.'
      : 'Submitted and confirmed by the requester. No AI diagnosis included.',
  ].join('\n');
}
/** Server-only adapters. No provider error bodies/tokens are persisted or exposed. */
export async function deliverSupportPacket(
  route: SupportRoute,
  packet: SupportPacket,
  options: {
    fetch?: typeof fetch;
    emailApiKey?: string;
    emailFrom?: string;
  } = {},
): Promise<string> {
  const http = options.fetch ?? fetch;
  const request = async (url: string, init: RequestInit): Promise<Response> => {
    let response: Response;
    try {
      response = await http(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new SupportDeliveryError(
        'Delivery confirmation unavailable. Automatic retry is scheduled.',
        true,
        true,
      );
    }
    if (!response.ok)
      throw new SupportDeliveryError(
        `Support provider returned HTTP ${response.status}.`,
        response.status === 429 || response.status >= 500,
      );
    return response;
  };
  if (route.channel === 'inbox') return packet.id;
  if (route.channel === 'email') {
    if (!options.emailApiKey || !options.emailFrom)
      throw new SupportDeliveryError(
        'Support email is not configured. Ask your administrator to configure delivery.',
        false,
      );
    const response = await request('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.emailApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `support/${packet.tenantId}/${packet.id}`,
      },
      body: JSON.stringify({
        from: options.emailFrom,
        to: [route.to],
        reply_to: packet.report.contactEmail,
        subject: `[CASE-${packet.id.slice(0, 8).toUpperCase()}] ${packet.serialNumber} — support request`,
        text: supportPacketText(packet),
        attachments: packet.files.map((f) => ({
          filename: f.filename,
          content: Buffer.from(f.bytes).toString('base64'),
          content_type: f.contentType,
        })),
      }),
    });
    return z.object({ id: z.string().min(1) }).parse(await response.json()).id;
  }
  const origin = new URL(route.instanceUrl).origin;
  const auth = await request(`${origin}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: route.clientId,
      client_secret: route.clientSecret,
    }),
  });
  const token = z.object({ access_token: z.string().min(1) }).parse(await auth.json()).access_token;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const base = `${origin}/services/data/${route.apiVersion}`;
  const externalKey = `${packet.tenantId}:${packet.id}`;
  const caseUrl = `${base}/sobjects/Case/${route.externalIdField}/${encodeURIComponent(externalKey)}`;
  // An existing record is the acknowledgement for a retried handoff. Do not overwrite service staff edits.
  const lookup = await http(`${caseUrl}?fields=Id`, {
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  let caseId: string;
  if (lookup.status === 404) {
    const inserted = await request(caseUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        Subject: `${packet.serialNumber} — support request`,
        Description: supportPacketText(packet),
        SuppliedName: packet.report.contactName,
        SuppliedEmail: packet.report.contactEmail,
        SuppliedPhone: packet.report.contactPhone,
        Origin: route.origin,
        ...(route.accountId ? { AccountId: route.accountId } : {}),
      }),
    });
    if (inserted.status === 204)
      caseId = remoteId.parse(
        ((await (await request(`${caseUrl}?fields=Id`, { headers })).json()) as { Id: string }).Id,
      );
    else caseId = remoteId.parse(((await inserted.json()) as { id: string }).id);
  } else {
    if (!lookup.ok)
      throw new SupportDeliveryError(
        `Support provider returned HTTP ${lookup.status}.`,
        lookup.status === 429 || lookup.status >= 500,
      );
    caseId = remoteId.parse(((await lookup.json()) as { Id: string }).Id);
  }
  for (const file of packet.files) {
    // Stable private file title allows reconciliation after a timeout/crash before acknowledgement.
    const title = `ArgonIQ-${file.id}`;
    const query = `SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = '${caseId}' AND ContentDocument.Title = '${title}'`;
    const found = z
      .object({ records: z.array(z.object({ ContentDocumentId: remoteId })) })
      .parse(
        await (await request(`${base}/query?q=${encodeURIComponent(query)}`, { headers })).json(),
      );
    if (found.records.length) continue;
    await request(`${base}/sobjects/ContentVersion`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        Title: title,
        PathOnClient: file.filename,
        VersionData: Buffer.from(file.bytes).toString('base64'),
        FirstPublishLocationId: caseId,
      }),
    });
  }
  return caseId;
}
