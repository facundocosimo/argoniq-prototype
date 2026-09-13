import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@argoniq/core-domain/env';
import { getLogger } from '@argoniq/observability';
import { getPersona } from '../../../../lib/demo/personas.js';
import {
  IMPERSONATE_COOKIE,
  IMPERSONATE_NAME_COOKIE,
  PERSONA_COOKIE,
} from '../../../../lib/trpc/context.js';

/**
 * DEV-ONLY session control — the persona switcher, tenant impersonation, and exit.
 * This is the write side of the auth-seam stand-in (see `lib/trpc/context.ts`): it
 * only sets/clears the persona + impersonation cookies the request layer reads.
 *
 * It is refused in production (no dev session there — the real auth seam replaces
 * this). Impersonation is the one privileged act: it is allowed ONLY when the
 * current persona is the platform operator, and it is audit-logged.
 */
const logger = getLogger({ transport: 'dev-session' });

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('persona'), key: z.string().min(1) }),
  z.object({
    action: z.literal('impersonate'),
    tenantId: z.string().uuid(),
    tenantName: z.string().min(1),
  }),
  z.object({ action: z.literal('exit') }),
]);

export async function POST(request: Request): Promise<NextResponse> {
  if (getEnv().NODE_ENV === 'production' || !getEnv().DEMO_AUTH_ENABLED) {
    return NextResponse.json({ error: 'not available' }, { status: 404 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const body = parsed.data;

  const res = NextResponse.json({ ok: true });
  const cookieOpts = { path: '/', sameSite: 'lax' as const };

  if (body.action === 'persona') {
    // Switching identity always clears any active impersonation.
    res.cookies.set(PERSONA_COOKIE, getPersona(body.key).key, cookieOpts);
    res.cookies.delete(IMPERSONATE_COOKIE);
    res.cookies.delete(IMPERSONATE_NAME_COOKIE);
    return res;
  }

  if (body.action === 'exit') {
    res.cookies.delete(IMPERSONATE_COOKIE);
    res.cookies.delete(IMPERSONATE_NAME_COOKIE);
    return res;
  }

  // Impersonation — privileged: only the platform operator may enter a tenant.
  if (getPersona(readCookie(request, PERSONA_COOKIE)).key !== 'platform') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  res.cookies.set(IMPERSONATE_COOKIE, body.tenantId, cookieOpts);
  res.cookies.set(IMPERSONATE_NAME_COOKIE, body.tenantName, cookieOpts);
  logger.info(
    { tenantId: body.tenantId, tenant: body.tenantName },
    'platform operator entered tenant (impersonation)',
  );
  return res;
}

function readCookie(request: Request, name: string): string | undefined {
  const raw = request.headers.get('cookie');
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}
