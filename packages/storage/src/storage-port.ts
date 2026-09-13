/**
 * Storage interface for uploaded documents and derived page images. The current
 * implementation uses local disk. Keys are opaque, forward-slash-delimited paths;
 * implementations must reject traversal outside their storage root.
 */
export interface StoragePort {
  /** Store bytes at `key`, overwriting any existing object. */
  put(key: string, bytes: Uint8Array, contentType?: string): Promise<void>;
  /** Read the bytes at `key`. Rejects if the object does not exist. */
  get(key: string): Promise<Uint8Array>;
  /** Whether an object exists at `key`. */
  exists(key: string): Promise<boolean>;
  /** Delete the object at `key` (no-op if absent). */
  delete(key: string): Promise<void>;
  /**
   * A URL the browser can fetch the object from. For local disk this is an app-relative
   * path served by a route handler. `expiresInSeconds` is reserved for backends
   * that support expiring URLs and is ignored by local disk.
   */
  url(key: string, expiresInSeconds?: number): Promise<string>;
}
