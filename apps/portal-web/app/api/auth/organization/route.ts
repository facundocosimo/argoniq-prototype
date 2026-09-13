import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UserId } from '@argoniq/core-domain';
import { getEnv } from '@argoniq/core-domain/env';
import { auth } from '../../../../lib/auth.js';
import {
  activeMemberships,
  membershipsForUser,
  resolveSelectedMembership,
} from '../../../../lib/authz.js';
import { ACTIVE_TENANT_COOKIE } from '../../../../lib/trpc/context.js';

const Body = z.object({ tenantId: z.string().uuid() });

/**
 * Selects a current OEM only after verifying both the Better Auth session and a
 * fresh active membership. The cookie speeds up subsequent requests; it grants no
 * access by itself and is always checked again by `currentIdentityState`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const env = getEnv();
  const origins = [new URL(env.APP_URL).origin, ...env.ALLOWED_ORIGINS];
  if (!origins.includes(request.headers.get('origin') ?? '')) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid organization' }, { status: 400 });

  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session ? UserId.safeParse(session.user.id) : null;
  if (!userId?.success) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const memberships = activeMemberships(await membershipsForUser(userId.data));
  if (!resolveSelectedMembership(memberships, body.data.tenantId)) {
    return NextResponse.json({ error: 'organization is not available' }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACTIVE_TENANT_COOKIE, body.data.tenantId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getEnv().NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
