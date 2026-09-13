/* eslint-disable no-restricted-globals -- CLI backfill: reads env at boot, sets exit code. */
import { DrizzleChunkRepository, createDatabase } from '@argoniq/db';
import { TenantId } from '@argoniq/core-domain';
import { getEnv } from '@argoniq/core-domain/env';
import { resolveEmbeddingsPort } from '@argoniq/intelligence/embeddings';
import { getLogger } from '@argoniq/observability';
import { embedChunkJob } from '../jobs/embed-chunk.js';

/**
 * One-shot backfill: embed every chunk that still has a NULL embedding, so seeded
 * chunks (inserted un-embedded) join the dense/vector retrieval arm instead of relying
 * on BM25 alone — without which they lose the hybrid-fusion top-k to the already-embedded
 * corpus. T4 is excluded (restricted content must never enter the vector arm). Idempotent:
 * `embedChunkJob` skips any chunk already embedded.
 *
 * Uses the migration role; repository access remains tenant-scoped. A tenant id
 * may be passed as argv[2]; otherwise the public sample tenant is used.
 */
const SAMPLE_TENANT = 'a1000000-0000-4000-8000-000000000001';

async function main(): Promise<void> {
  const env = getEnv();
  const logger = getLogger({ module: 'backfill-embeddings' });
  const tenantId = TenantId.parse(process.argv[2] ?? SAMPLE_TENANT);
  const db = createDatabase(env.DATABASE_MIGRATION_URL ?? env.DATABASE_URL);
  const chunks = new DrizzleChunkRepository(db);
  const embeddings = resolveEmbeddingsPort(logger);

  const pending = await chunks.listPendingEmbedding(tenantId, embeddings.model);
  logger.info({ tenantId, pending: pending.length }, 'backfill: chunks to embed');

  let embedded = 0;
  let skipped = 0;
  for (const chunkId of pending) {
    const outcome = await embedChunkJob({ chunks, embeddings, logger }, { tenantId, chunkId });
    if (outcome.status === 'embedded') embedded++;
    else skipped++;
  }

  logger.info({ embedded, skipped, total: pending.length }, 'backfill: done');
  process.exit(0);
}

main().catch((error: unknown) => {
  getLogger({ module: 'backfill-embeddings' }).error({ err: error }, 'backfill failed');
  process.exit(1);
});
