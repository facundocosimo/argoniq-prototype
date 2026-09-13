import { describe, expect, it } from 'vitest';
import { EMPTY_CHUNK_STATS, computeDocumentHealth, type ChunkStats } from './document-health.js';

const stats = (o: Partial<ChunkStats>): ChunkStats => ({ ...EMPTY_CHUNK_STATS, ...o });

describe('computeDocumentHealth', () => {
  it('is ready when ingested with all embeddable chunks embedded', () => {
    const h = computeDocumentHealth(
      'ingested',
      stats({ chunkCount: 5, embeddedChunkCount: 4, embeddableChunkCount: 4, tableChunkCount: 2 }),
    );
    expect(h.state).toBe('ready');
    expect(h.issues).toHaveLength(0);
  });

  it('flags embeddings_incomplete (degraded) when some embeddable chunks are unembedded', () => {
    const h = computeDocumentHealth(
      'ingested',
      stats({ chunkCount: 6, embeddedChunkCount: 2, embeddableChunkCount: 6 }),
    );
    expect(h.state).toBe('degraded');
    expect(h.issues).toEqual([
      expect.objectContaining({ code: 'embeddings_incomplete', severity: 'warning' }),
    ]);
    expect(h.issues[0]!.message).toContain('4 of 6');
  });

  it('does not flag missing embeddings that are only the excluded (T4) chunks', () => {
    // 3 chunks, 0 embedded, but none are embeddable (all T4) → complete coverage.
    const h = computeDocumentHealth(
      'ingested',
      stats({ chunkCount: 3, embeddedChunkCount: 0, embeddableChunkCount: 0 }),
    );
    expect(h.state).toBe('ready');
    expect(h.issues).toHaveLength(0);
  });

  it('flags no_chunks (error) when ingested but empty', () => {
    const h = computeDocumentHealth('ingested', EMPTY_CHUNK_STATS);
    expect(h.state).toBe('degraded');
    expect(h.issues[0]).toMatchObject({ code: 'no_chunks', severity: 'error' });
  });

  it('maps failed → failed with an error issue', () => {
    const h = computeDocumentHealth('failed', EMPTY_CHUNK_STATS);
    expect(h.state).toBe('failed');
    expect(h.issues[0]).toMatchObject({ code: 'ingestion_failed', severity: 'error' });
  });

  it('maps uploaded/processing → pending (info only)', () => {
    for (const s of ['uploaded', 'processing']) {
      const h = computeDocumentHealth(s, EMPTY_CHUNK_STATS);
      expect(h.state).toBe('pending');
      expect(h.issues[0]).toMatchObject({ code: 'processing', severity: 'info' });
    }
  });

  it('treats an uploaded reference-only artifact as ready without chunks', () => {
    const h = computeDocumentHealth('uploaded', EMPTY_CHUNK_STATS, false);
    expect(h.state).toBe('ready');
    expect(h.issues).toHaveLength(0);
  });
});
