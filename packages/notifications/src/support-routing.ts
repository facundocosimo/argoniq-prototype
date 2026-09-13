import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getEnv } from '@argoniq/core-domain/env';
import { type SupportDestination } from '@argoniq/core-domain';

const field = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/);
const salesforceHost = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    url.hostname.endsWith('.my.salesforce.com') &&
    url.pathname === '/' &&
    !url.username &&
    !url.password &&
    !url.port &&
    !url.search &&
    !url.hash
  );
}, 'Use your Salesforce My Domain HTTPS origin.');
const common = {
  id: z.string().min(1).max(80),
  tenantId: z.uuid(),
  companyId: z.uuid().optional(),
  label: z.string().trim().min(1).max(120),
};
export const SupportRoute = z.discriminatedUnion('channel', [
  z.object({ ...common, channel: z.literal('inbox') }),
  z.object({ ...common, channel: z.literal('email'), to: z.email() }),
  z.object({
    ...common,
    channel: z.literal('servicemax'),
    instanceUrl: salesforceHost,
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    apiVersion: z.string().regex(/^v\d{2,3}\.0$/),
    externalIdField: field,
    accountId: z
      .string()
      .regex(/^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/)
      .optional(),
    origin: z.string().max(80).default('Web'),
  }),
]);
export type SupportRoute = z.infer<typeof SupportRoute>;
export function supportRoutes(raw = getEnv().SUPPORT_ROUTES): SupportRoute[] {
  const routes = z.array(SupportRoute).parse(JSON.parse(raw));
  const scopes = routes.map((r) => `${r.tenantId}:${r.companyId ?? '*'}`);
  if (
    new Set(scopes).size !== scopes.length ||
    new Set(routes.map((r) => r.id)).size !== routes.length
  )
    throw new Error('Support routes must have unique IDs and tenant/company scopes.');
  return routes;
}
export function resolveSupportRoute(
  tenantId: string,
  companyId: string,
  routes = supportRoutes(),
): SupportRoute {
  return (
    routes.find((r) => r.tenantId === tenantId && r.companyId === companyId) ??
    routes.find((r) => r.tenantId === tenantId && !r.companyId) ?? {
      id: 'default-inbox',
      tenantId,
      channel: 'inbox',
      label: 'Manufacturer support',
    }
  );
}
export function publicDestination(route: SupportRoute): SupportDestination {
  // Credential rotation must not reroute pending requests; routing changes require fresh review.
  const {
    clientSecret: _secret,
    clientId: _client,
    ...destination
  } = route as SupportRoute & { clientSecret?: string; clientId?: string };
  return {
    id: route.id,
    label: route.label,
    channel: route.channel,
    version: createHash('sha256').update(JSON.stringify(destination)).digest('hex'),
  };
}
