import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '../../../../lib/auth.js';
import { ACTIVE_TENANT_COOKIE } from '../../../../lib/trpc/context.js';
import { getEnv } from '@argoniq/core-domain/env';

/** Better Auth's verified, CSRF/origin-checked HTTP surface. */
const handler = toNextJsHandler(auth);

export const GET = handler.GET;
export const PATCH = handler.PATCH;
export const PUT = handler.PUT;
export const DELETE = handler.DELETE;

/** Sign-out must also discard the non-authoritative organization convenience cookie. */
export async function POST(request: Request): Promise<Response> {
  const env = getEnv();
  if (
    new URL(request.url).pathname.endsWith('/request-password-reset') &&
    env.NODE_ENV === 'production' &&
    !(env.AUTH_SMTP_URL && env.AUTH_EMAIL_FROM)
  ) {
    return Response.json({ error: 'Password recovery is not configured.' }, { status: 503 });
  }
  const response = await handler.POST(request);
  if (new URL(request.url).pathname.endsWith('/sign-out')) {
    response.headers.append(
      'Set-Cookie',
      `${ACTIVE_TENANT_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    );
  }
  return response;
}
