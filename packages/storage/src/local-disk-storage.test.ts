import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalDiskStorage } from './local-disk-storage.js';
import { documentSourceKey } from './keys.js';

describe('LocalDiskStorage', () => {
  let root: string;
  let storage: LocalDiskStorage;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'argoniq-storage-'));
    storage = new LocalDiskStorage({ root });
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('round-trips bytes through put → get and reports existence', async () => {
    const key = documentSourceKey('t1', 'd1');
    const bytes = new TextEncoder().encode('%PDF-1.7 fake');
    expect(await storage.exists(key)).toBe(false);
    await storage.put(key, bytes);
    expect(await storage.exists(key)).toBe(true);
    expect(new TextDecoder().decode(await storage.get(key))).toBe('%PDF-1.7 fake');
  });

  it('deletes objects idempotently', async () => {
    const key = documentSourceKey('t1', 'd2');
    await storage.put(key, new Uint8Array([1, 2, 3]));
    await storage.delete(key);
    await storage.delete(key); // no throw on absent
    expect(await storage.exists(key)).toBe(false);
  });

  it('refuses a key that escapes the storage root (path traversal)', async () => {
    await expect(storage.put('../escape.txt', new Uint8Array([0]))).rejects.toThrow(/escapes root/);
    await expect(storage.get('../../etc/passwd')).rejects.toThrow(/escapes root/);
  });

  it('builds an app-relative download url from the key', async () => {
    expect(await storage.url('tenants/t1/documents/d1/source.pdf')).toBe(
      '/api/storage/tenants/t1/documents/d1/source.pdf',
    );
  });
});
