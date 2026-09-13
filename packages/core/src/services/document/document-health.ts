/**
 * Ingestion health for a document — the OEM-facing answer to "did this ingest properly,
 * how many chunks, and are there any issues?". Derived (never stored): chunk counts come
 * from `document_chunks`, and the issue list is computed from the document status + those
 * counts. The load-bearing signal is EMBEDDING COVERAGE: a document can be `ingested`
 * with chunks yet be effectively unfindable if its chunks were never embedded — the exact
 * failure mode that is otherwise invisible. T4 chunks are excluded from the embeddable
 * count by design (restricted content never enters the vector arm).
 */

/** Per-document chunk tallies (from `document_chunks`). */
export interface ChunkStats {
  readonly chunkCount: number;
  /** Chunks with a dense embedding present. */
  readonly embeddedChunkCount: number;
  /** Chunks that SHOULD be embedded (all non-T4 chunks). */
  readonly embeddableChunkCount: number;
  readonly tableChunkCount: number;
  readonly figureChunkCount: number;
}

export const EMPTY_CHUNK_STATS: ChunkStats = {
  chunkCount: 0,
  embeddedChunkCount: 0,
  embeddableChunkCount: 0,
  tableChunkCount: 0,
  figureChunkCount: 0,
};

export type DocumentIssueCode =
  'ingestion_failed' | 'processing' | 'no_chunks' | 'embeddings_incomplete';

export type DocumentIssueSeverity = 'error' | 'warning' | 'info';

export interface DocumentIssue {
  readonly code: DocumentIssueCode;
  readonly severity: DocumentIssueSeverity;
  readonly message: string;
}

/** Rolled-up ingestion state, for a single at-a-glance dot/label in the UI. */
export type DocumentHealthState = 'ready' | 'degraded' | 'pending' | 'failed';

export interface DocumentHealth extends ChunkStats {
  readonly status: string;
  readonly state: DocumentHealthState;
  readonly issues: readonly DocumentIssue[];
}

/**
 * Compute a document's health from its stored `status` and chunk tallies. Pure — unit
 * tested without a database. `ingested` is only truly "ready" when it has chunks AND
 * every embeddable chunk is embedded; otherwise it is `degraded` with an explicit issue.
 */
export function computeDocumentHealth(
  status: string,
  stats: ChunkStats,
  indexable = true,
): DocumentHealth {
  // Reference-only artifacts intentionally never enter ingestion. Their source is ready
  // as soon as upload completes, so an `uploaded` status is terminal rather than pending.
  if (!indexable && status === 'uploaded') {
    return { status, ...stats, state: 'ready', issues: [] };
  }

  const issues: DocumentIssue[] = [];

  if (status === 'failed') {
    issues.push({
      code: 'ingestion_failed',
      severity: 'error',
      message: 'Ingestion failed. Re-ingest to try again.',
    });
  } else if (status === 'uploaded' || status === 'processing') {
    issues.push({
      code: 'processing',
      severity: 'info',
      message: 'Ingestion in progress — chunks and embeddings are still being produced.',
    });
  } else if (status === 'ingested') {
    if (stats.chunkCount === 0) {
      issues.push({
        code: 'no_chunks',
        severity: 'error',
        message: 'No text was extracted — nothing from this document is retrievable.',
      });
    } else if (stats.embeddedChunkCount < stats.embeddableChunkCount) {
      const missing = stats.embeddableChunkCount - stats.embeddedChunkCount;
      issues.push({
        code: 'embeddings_incomplete',
        severity: 'warning',
        message: `${missing} of ${stats.embeddableChunkCount} chunks are not embedded — semantic retrieval is degraded until they are re-embedded.`,
      });
    }
  }

  const state: DocumentHealthState =
    status === 'failed'
      ? 'failed'
      : status === 'uploaded' || status === 'processing'
        ? 'pending'
        : issues.some((i) => i.severity === 'error' || i.severity === 'warning')
          ? 'degraded'
          : 'ready';

  return { status, ...stats, state, issues };
}
