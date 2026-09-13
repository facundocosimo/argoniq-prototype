import { describe, expect, it } from 'vitest';
import { ConflictError } from '@argoniq/observability';
import { withReferenceConflict, withUniqueConflict } from './db-errors.js';

describe('database conflict translation', () => {
  it.each(['23503', '23001'])(
    'maps nested reference SQLSTATE %s without exposing SQL',
    async (code) => {
      const driver = Object.assign(new Error('private driver details'), { code });
      const wrapper = new Error('private SQL and parameters', { cause: driver });
      await expect(
        withReferenceConflict('Review linked documents.', () => Promise.reject(wrapper)),
      ).rejects.toMatchObject({ code: 'CONFLICT', message: 'Review linked documents.' });
    },
  );

  it('retains unique-constraint translation through the same wrapper', async () => {
    const driver = Object.assign(new Error('duplicate'), { code: '23505' });
    await expect(
      withUniqueConflict('Already exists.', () =>
        Promise.reject(new Error('query', { cause: driver })),
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('preserves unrelated driver errors', async () => {
    const error = Object.assign(new Error('serialization conflict'), { code: '40001' });
    await expect(
      withReferenceConflict('References exist.', () => Promise.reject(error)),
    ).rejects.toBe(error);
  });

  it('terminates for a circular cause without replacing the error', async () => {
    const error = new Error('circular cause') as Error & { cause?: unknown };
    error.cause = error;
    await expect(
      withReferenceConflict('References exist.', () => Promise.reject(error)),
    ).rejects.toBe(error);
  });

  it('preserves a successful service result', async () => {
    await expect(
      withReferenceConflict('References exist.', () => Promise.resolve('saved')),
    ).resolves.toBe('saved');
  });
});
