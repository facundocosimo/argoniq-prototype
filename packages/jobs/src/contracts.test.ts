import { describe, expect, it } from 'vitest';
import {
  ALL_QUEUES,
  EMBED_CHUNK_QUEUE,
  EmbedChunkPayload,
  INGEST_DOCUMENT_QUEUE,
  IngestDocumentPayload,
} from './contracts.js';

/**
 * The job contracts are the shared trust edge between the web-tier enqueuer and the
 * worker consumer; both validate the same schema. These lock the queue names (a rename
 * would silently split producer/consumer) and that payloads reject malformed ids.
 */
describe('job contracts', () => {
  it('exposes stable queue names', () => {
    expect(INGEST_DOCUMENT_QUEUE).toBe('ingest-document');
    expect(EMBED_CHUNK_QUEUE).toBe('embed-chunk');
    expect(ALL_QUEUES).toContain(INGEST_DOCUMENT_QUEUE);
    expect(ALL_QUEUES).toContain(EMBED_CHUNK_QUEUE);
  });

  it('validates ingest-document payloads (branded uuids)', () => {
    const ok = IngestDocumentPayload.safeParse({
      tenantId: '7c084f7f-92c4-57dd-814b-5fb5d955ea4f',
      documentId: '75781d29-98af-42bf-b54e-b4f505698f4c',
    });
    expect(ok.success).toBe(true);
    expect(IngestDocumentPayload.safeParse({ tenantId: 'nope', documentId: 'nope' }).success).toBe(
      false,
    );
  });

  it('validates embed-chunk payloads', () => {
    expect(
      EmbedChunkPayload.safeParse({
        tenantId: '7c084f7f-92c4-57dd-814b-5fb5d955ea4f',
        chunkId: '75781d29-98af-42bf-b54e-b4f505698f4c',
      }).success,
    ).toBe(true);
  });
});
