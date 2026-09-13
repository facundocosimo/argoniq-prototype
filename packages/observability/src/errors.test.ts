import { describe, expect, it } from 'vitest';
import { InternalError, NotFoundError, TenantIsolationError, isAppError } from './errors.js';

describe('AppError', () => {
  it('maps to a safe envelope and exposes the message by default', () => {
    const env = new NotFoundError('serial', 'abc').toEnvelope('corr-1');
    expect(env.code).toBe('NOT_FOUND');
    expect(env.message).toBe('serial not found');
    expect(env.correlationId).toBe('corr-1');
    expect(env.details).toEqual({ resource: 'serial', id: 'abc' });
  });

  it('never exposes internal or isolation error messages', () => {
    expect(new InternalError('db pool exhausted').toEnvelope().message).toBe(
      'An unexpected error occurred.',
    );
    expect(new TenantIsolationError('tenant A read tenant B doc').toEnvelope().message).toBe(
      'An unexpected error occurred.',
    );
  });

  it('is identifiable via the type guard', () => {
    expect(isAppError(new InternalError())).toBe(true);
    expect(isAppError(new Error('plain'))).toBe(false);
  });
});
