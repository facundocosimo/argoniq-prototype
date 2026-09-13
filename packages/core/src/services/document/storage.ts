import { LocalDiskStorage, type StoragePort, resolveLocalRoot } from '@argoniq/storage';
import { getEnv } from '@argoniq/core-domain/env';

/**
 * Resolve the process-wide storage implementation. This prototype supports local
 * disk only and fails explicitly when object storage is configured.
 */
let cached: StoragePort | undefined;

export function resolveStoragePort(): StoragePort {
  if (cached) return cached;
  const env = getEnv();
  if (env.STORAGE_BUCKET) {
    // S3/R2 impl is intentionally deferred; fail loudly rather than silently mis-store.
    throw new Error(
      'object-store StoragePort not implemented yet; unset STORAGE_BUCKET for local disk',
    );
  }
  cached = new LocalDiskStorage({ root: resolveLocalRoot(env.STORAGE_LOCAL_ROOT) });
  return cached;
}
