import { describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import {
  NotFoundError,
  ForbiddenError,
  InternalError,
  TenantIsolationError,
  runWithContext,
} from '@argoniq/observability';
import { baseProcedure, router } from './trpc.js';

describe('service error transport mapping', () => {
  it('returns NOT_FOUND for an unavailable record instead of an internal error', async () => {
    const api = router({
      read: baseProcedure.query(() => {
        throw new NotFoundError('serial', 'unavailable');
      }),
    }).createCaller({ service: null, platform: null });
    await expect(api.read()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('preserves an explicit service access denial', async () => {
    const api = router({
      read: baseProcedure.query(() => {
        throw new ForbiddenError('Not allowed');
      }),
    }).createCaller({ service: null, platform: null });
    await expect(api.read()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('hides unknown error messages from server callers while retaining the cause', async () => {
    const failure = new Error('Failed query: select private_data; params: secret');
    const api = router({
      read: baseProcedure.query(() => {
        throw failure;
      }),
    }).createCaller({ service: null, platform: null });

    await expect(api.read()).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'The request could not be completed. Please try again.',
      cause: { cause: failure },
    });
  });

  it.each([
    new Error('Failed query: select private_data; params: secret'),
    new InternalError('Provider payload contains secret'),
    new TenantIsolationError('Foreign tenant secret'),
    new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database secret' }),
  ])('omits internal messages and development stacks from HTTP errors: %s', async (failure) => {
    const testRouter = router({
      read: baseProcedure.query(() => {
        throw failure;
      }),
    });
    const response = await runWithContext({ correlationId: 'chat-error-reference' }, () =>
      fetchRequestHandler({
        endpoint: '/trpc',
        req: new Request('http://localhost/trpc/read'),
        router: testRouter,
        createContext: () => ({ service: null, platform: null }),
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(failure instanceof TenantIsolationError ? 403 : 500);
    expect(body).toContain('The request could not be completed. Please try again.');
    expect(body).toContain('chat-error-reference');
    expect(body).not.toContain('secret');
    expect(body).not.toContain('private_data');
    expect(body).not.toContain('stack');
  });
});
