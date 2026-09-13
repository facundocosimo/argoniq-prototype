import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { type StoragePort } from './storage-port.js';

/**
 * Local-filesystem {@link StoragePort} for development (zero external setup). Objects
 * live under `root`, keyed by their storage key. Keys are treated as opaque relative
 * paths and every resolved path is asserted to stay within `root` — a `../` traversal
 * throws rather than escaping the sandbox. `url()` returns an app route path
 * (`urlPrefix` + key) that a Next.js route handler streams from disk; there is no
 * expiry on local disk, so `expiresInSeconds` is ignored.
 */
export class LocalDiskStorage implements StoragePort {
  private readonly root: string;
  private readonly urlPrefix: string;

  constructor(options: { root: string; urlPrefix?: string }) {
    this.root = resolve(options.root);
    // Default to the storage-download route exposed by the portal.
    this.urlPrefix = options.urlPrefix ?? '/api/storage/';
  }

  /** Resolve `key` under `root`, refusing any path that escapes the storage root. */
  private pathFor(key: string): string {
    const full = resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error(`storage key escapes root: ${key}`);
    }
    return full;
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async get(key: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.pathFor(key)));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  url(key: string): Promise<string> {
    // Normalize to forward slashes for the URL regardless of platform separator.
    const rel = key.split(sep).join('/');
    return Promise.resolve(this.urlPrefix + rel);
  }

  /** The absolute on-disk path for a key — used by a local download route to stream it. */
  absolutePath(key: string): string {
    return join(this.root, key);
  }
}
