import { describe, it, expect, vi } from 'vitest';
import { deliverSupportPacket, type SupportPacket, supportPacketText } from './support-delivery.js';
import {
  resolveSupportRoute,
  publicDestination,
  supportRoutes,
  type SupportRoute,
} from './support-routing.js';
const tenantId = 'a1000000-0000-4000-8000-000000000001',
  companyId = 'a1000000-0000-4000-8000-000000000002';
const packet: SupportPacket = {
  id: 'a1000000-0000-4000-8000-000000000003',
  tenantId,
  summary: 'Machine stopped',
  serialNumber: 'A-100',
  companyName: 'Factory',
  siteName: 'Plant',
  report: {
    contactName: 'Reporter',
    contactEmail: 'reporter@example.invalid',
    contactPhone: '',
    contactPreference: 'email',
    impact: 'stopped',
    safetyConcern: 'unknown',
    alarmCode: 'E42',
    startedAt: '',
    observations: '',
  },
  files: [
    {
      id: 'a1000000-0000-4000-8000-000000000004',
      filename: 'alarm.log',
      contentType: 'text/plain',
      bytes: Buffer.from('E42'),
    },
  ],
};
const mail: SupportRoute = {
  id: 'email',
  tenantId,
  label: 'Support',
  channel: 'email',
  to: 'team@example.invalid',
};
const salesforce: SupportRoute = {
  id: 'sf',
  tenantId,
  label: 'ServiceMax team',
  channel: 'servicemax',
  instanceUrl: 'https://synthetic.my.salesforce.com',
  clientId: 'synthetic',
  clientSecret: 'secret',
  apiVersion: 'v64.0',
  externalIdField: 'ArgonIQ_Request_Id__c',
  origin: 'Web',
};
const json = (data: unknown, status = 200) => Response.json(data, { status });
describe('support routing', () => {
  it('scopes overrides to tenant and company', () => {
    const override = { ...mail, id: 'company', companyId };
    expect(resolveSupportRoute(tenantId, companyId, [salesforce, override])).toEqual(override);
    expect(resolveSupportRoute(tenantId, 'other', [salesforce, override])).toEqual(salesforce);
    expect(resolveSupportRoute('other', companyId, [salesforce, override]).channel).toBe('inbox');
  });
  it('redacts credentials and binds review to routing changes', () => {
    expect(JSON.stringify(publicDestination(salesforce))).not.toContain('secret');
    expect(publicDestination({ ...salesforce, clientSecret: 'rotated' })).toEqual(
      publicDestination(salesforce),
    );
    expect(publicDestination({ ...mail, to: 'new@example.invalid' }).version).not.toEqual(
      publicDestination(mail).version,
    );
  });
  it('rejects ambiguous routes and non-Salesforce credential destinations', () => {
    expect(() => supportRoutes(JSON.stringify([mail, mail]))).toThrow();
    for (const instanceUrl of [
      'https://evil.example',
      'http://x.my.salesforce.com',
      'https://x.my.salesforce.com@evil.example',
      'https://x.my.salesforce.com:444',
      'https://x.my.salesforce.com/path',
    ])
      expect(() => supportRoutes(JSON.stringify([{ ...salesforce, instanceUrl }]))).toThrow();
  });
});
describe('support delivery', () => {
  it('sends confirmed report and files with stable email idempotency key', async () => {
    const http = vi.fn<typeof fetch>().mockResolvedValue(json({ id: 'email-id' }));
    expect(
      await deliverSupportPacket(mail, packet, {
        fetch: http,
        emailApiKey: 'synthetic',
        emailFrom: 'sender@example.invalid',
      }),
    ).toBe('email-id');
    const [url, init] = http.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init?.redirect).toBe('error');
    expect((init?.headers as Record<string, string>)['Idempotency-Key']).toBe(
      `support/${tenantId}/${packet.id}`,
    );
    const body = JSON.parse(init?.body as string) as {
      reply_to: string;
      attachments: { content: string }[];
      text: string;
    };
    expect(body.reply_to).toBe(packet.report.contactEmail);
    expect(Buffer.from(body.attachments[0]!.content, 'base64').toString()).toBe('E42');
    expect(body.text).toContain('Reported impact: Machine stopped');
  });
  it('fails closed for missing email configuration', async () => {
    const http = vi.fn<typeof fetch>();
    await expect(deliverSupportPacket(mail, packet, { fetch: http })).rejects.toMatchObject({
      retryable: false,
    });
    expect(http).not.toHaveBeenCalled();
  });
  it('redacts provider error bodies and retries transient failures', async () => {
    const http = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('secret detail', { status: 503 }));
    await expect(
      deliverSupportPacket(mail, packet, {
        fetch: http,
        emailApiKey: 'key',
        emailFrom: 'sender@example.invalid',
      }),
    ).rejects.toMatchObject({ retryable: true, message: 'Support provider returned HTTP 503.' });
  });
  it('preserves ambiguous network outcomes', async () => {
    const http = vi.fn<typeof fetch>().mockRejectedValue(new Error('private detail'));
    await expect(
      deliverSupportPacket(mail, packet, {
        fetch: http,
        emailApiKey: 'key',
        emailFrom: 'sender@example.invalid',
      }),
    ).rejects.toMatchObject({ retryable: true, uncertain: true });
  });
  it('upserts Salesforce Case and uploads file bytes', async () => {
    const http = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ access_token: 'token' }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(json({ id: '500000000000001AAA' }, 201))
      .mockResolvedValueOnce(json({ records: [] }))
      .mockResolvedValueOnce(json({ id: '068000000000001AAA' }, 201));
    expect(await deliverSupportPacket(salesforce, packet, { fetch: http })).toBe(
      '500000000000001AAA',
    );
    const [url, init] = http.mock.calls[2]!;
    expect(url as string).toContain('/sobjects/Case/ArgonIQ_Request_Id__c/');
    expect(init?.method).toBe('PATCH');
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(body.Description).toBe(supportPacketText(packet));
    expect(body).not.toHaveProperty('Priority');
    expect(body).not.toHaveProperty('Status');
    const content = JSON.parse(http.mock.calls[4]![1]?.body as string) as Record<string, string>;
    expect(content.FirstPublishLocationId).toBe('500000000000001AAA');
    expect(content.PathOnClient).toBe('alarm.log');
    expect(content.VersionData).toBe('RTQy');
  });
  it('reconciles existing case and file without overwriting staff edits', async () => {
    const http = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ access_token: 'token' }))
      .mockResolvedValueOnce(json({ Id: '500000000000001AAA' }))
      .mockResolvedValueOnce(json({ records: [{ ContentDocumentId: '069000000000001AAA' }] }));
    expect(await deliverSupportPacket(salesforce, packet, { fetch: http })).toBe(
      '500000000000001AAA',
    );
    expect(http.mock.calls.slice(1).every(([, init]) => !init?.method)).toBe(true);
  });
  it('does not retry validation failures', async () => {
    const http = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('private detail', { status: 400 }));
    await expect(deliverSupportPacket(salesforce, packet, { fetch: http })).rejects.toMatchObject({
      retryable: false,
      message: 'Support provider returned HTTP 400.',
    });
  });
});
