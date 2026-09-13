import { appendFile, mkdir } from 'node:fs/promises';
import { cwd } from 'node:process';
import { dirname, resolve } from 'node:path';
import nodemailer from 'nodemailer';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { getEnv } from '@argoniq/core-domain/env';
import { getDatabase, schema } from '@argoniq/db';
import { getLogger } from '@argoniq/observability';

const env = getEnv();
const logger = getLogger({ module: 'auth' });

/**
 * The authentication provider owns credentials and durable sessions. It does not
 * decide tenant access: `lib/authz.ts` resolves every verified session through an
 * active membership before creating an Actor for the service layer.
 */
export const auth = betterAuth({
  appName: 'ArgonIQ',
  baseURL: env.APP_URL,
  secret: env.AUTH_SECRET,
  trustedOrigins: env.ALLOWED_ORIGINS,
  database: drizzleAdapter(getDatabase(), {
    provider: 'pg',
    schema,
  }),
  user: { modelName: 'authUsers' },
  session: { modelName: 'authSessions', cookieCache: { enabled: false } },
  account: { modelName: 'authAccounts' },
  verification: { modelName: 'authVerifications' },
  advanced: {
    database: { generateId: 'uuid' },
    // Keep the default origin and CSRF checks on. Cookies are secure in production.
  },
  emailAndPassword: {
    enabled: true,
    // Accounts are introduced by the invitation/onboarding slice, never by public sign-up.
    disableSignUp: true,
    minPasswordLength: 12,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: deliverResetLink,
    onPasswordReset: ({ user }) => {
      logger.info({ userId: user.id }, 'password reset completed');
      return Promise.resolve();
    },
  },
  plugins: [nextCookies()],
});

/**
 * Production recovery uses configured SMTP delivery. Development without SMTP
 * captures links in a gitignored local outbox. Production never uses that fallback.
 */
async function deliverResetLink({
  user,
  url,
}: {
  user: { id: string; email: string };
  url: string;
}): Promise<void> {
  if (env.AUTH_SMTP_URL && env.AUTH_EMAIL_FROM) {
    const transporter = nodemailer.createTransport(env.AUTH_SMTP_URL);
    await transporter.sendMail({
      from: env.AUTH_EMAIL_FROM,
      to: user.email,
      subject: 'Reset your ArgonIQ password',
      text: `A password reset was requested for your ArgonIQ account.\n\nOpen this link to choose a new password:\n${url}\n\nIf you did not request this, you can ignore this email.`,
    });
    return;
  }
  if (env.NODE_ENV === 'production') {
    logger.error(
      { userId: user.id },
      'password reset requested without an email delivery provider',
    );
    throw new Error('Password recovery email delivery is not configured.');
  }

  const outboxPath = resolve(cwd(), '.auth-outbox', 'password-reset.jsonl');
  await mkdir(dirname(outboxPath), { recursive: true });
  await appendFile(
    outboxPath,
    `${JSON.stringify({ type: 'password-reset', email: user.email, url, createdAt: new Date().toISOString() })}\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
  logger.info({ userId: user.id }, 'password reset link captured in local development outbox');
}
