import { describe, expect, it, vi } from 'vitest';
import { DocumentChunkId, DocumentId, TenantId } from '@argoniq/core-domain';
import {
  type ChunkInsert,
  type CreateDocumentInput,
  type DocumentRepository,
  type IngestableDocument,
  type IngestionMetadata,
} from '@argoniq/db';
import {
  FixtureParser,
  type ParsedDocument,
  type PdfParserPort,
} from '@argoniq/intelligence/ingestion';
import { type StoragePort } from '@argoniq/storage';
import { type Logger } from '@argoniq/observability';
import { ingestDocumentJob } from './ingest-document.js';

const TENANT = TenantId.parse('11111111-1111-4111-8111-111111111111');
const DOC = DocumentId.parse('d1111111-1111-4111-8111-111111111111');

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

const parsed: ParsedDocument = {
  pageCount: 8,
  language: 'en',
  revision: { docKey: 'FICTIONAL-NETWORK', label: 'A', effectiveFrom: '2026-01-01' },
  blocks: [
    {
      kind: 'heading',
      text: 'Demo Network',
      page: 4,
      sectionNumber: '4.2',
      level: 2,
    },
    { kind: 'table', text: '| Demo port | PORT-A |', page: 4 },
    { kind: 'paragraph', text: 'This invented network exists only for training.', page: 4 },
  ],
};

function fakeStorage(bytes = new Uint8Array([1, 2, 3])): StoragePort {
  return {
    get: () => Promise.resolve(bytes),
    put: () => Promise.resolve(),
    exists: () => Promise.resolve(true),
    delete: () => Promise.resolve(),
    url: (k) => Promise.resolve(`/api/storage/${k}`),
  };
}

class FakeDocumentRepo implements DocumentRepository {
  statuses: string[] = [];
  inserted: ChunkInsert[] | null = null;
  completed: IngestionMetadata | null = null;
  constructor(private readonly doc: IngestableDocument | null) {}
  claimIngestion() {
    if (!this.doc) return Promise.resolve(null);
    this.statuses.push('processing');
    return Promise.resolve({ ...this.doc, token: 'attempt-one' });
  }
  async commitIngestion(
    t: TenantId,
    d: DocumentId,
    _token: string,
    chunks: readonly ChunkInsert[],
    report: { pages: number; textPages: number; reviewChunks: number },
  ) {
    this.completed = { pageCount: report.pages };
    return this.replaceChunks(t, d, 'T1', chunks);
  }
  failIngestion() {
    this.statuses.push('failed');
    return Promise.resolve();
  }
  createDocument(_t: TenantId, _input: CreateDocumentInput): Promise<DocumentId> {
    return Promise.resolve(DOC);
  }
  loadForIngest(): Promise<IngestableDocument | null> {
    return Promise.resolve(this.doc);
  }
  setStatus(
    _t: TenantId,
    _d: DocumentId,
    status: 'uploaded' | 'processing' | 'ingested' | 'failed',
  ) {
    this.statuses.push(status);
    return Promise.resolve();
  }
  replaceChunks(_t: TenantId, _d: DocumentId, _tier: unknown, chunks: readonly ChunkInsert[]) {
    this.inserted = [...chunks];
    return Promise.resolve(
      chunks.map((_, i) => DocumentChunkId.parse(`c0000000-0000-4000-8000-00000000000${i}`)),
    );
  }
  completeIngestion(_t: TenantId, _d: DocumentId, meta: IngestionMetadata) {
    this.completed = meta;
    return Promise.resolve();
  }
}

const doc: IngestableDocument = {
  id: DOC,
  tier: 'T1',
  title: 'Atlas Training Cell Reference',
  storageKey: 'k',
};

describe('ingestDocumentJob', () => {
  it('parses → chunks → persists → completes → enqueues one embed per chunk', async () => {
    const documents = new FakeDocumentRepo(doc);
    const enqueueEmbed = vi.fn().mockResolvedValue(undefined);
    const outcome = await ingestDocumentJob(
      {
        documents,
        storage: fakeStorage(),
        parser: new FixtureParser(parsed),
        enqueueEmbed,
        logger,
      },
      { tenantId: TENANT, documentId: DOC },
    );

    expect(outcome.status).toBe('ingested');
    if (outcome.status === 'ingested') {
      expect(outcome.pages).toBe(8);
      expect(outcome.chunks).toBeGreaterThan(0);
    }
    // processing before, no failure.
    expect(documents.statuses).toEqual(['processing']);
    // The atomic table survived into a persisted table chunk.
    expect(
      documents.inserted?.some((c) => c.chunkType === 'table' && c.sectionPath === '4.2'),
    ).toBe(true);
    // Parser-detected revision flowed into completion metadata.
    expect(documents.completed?.pageCount).toBe(8);
    expect(documents.completed?.docKey).toBeUndefined();
    // One embed job per persisted chunk.
    expect(enqueueEmbed).toHaveBeenCalledTimes(documents.inserted!.length);
  });

  it('is a no-op when the document is missing', async () => {
    const documents = new FakeDocumentRepo(null);
    const enqueueEmbed = vi.fn();
    const outcome = await ingestDocumentJob(
      {
        documents,
        storage: fakeStorage(),
        parser: new FixtureParser(parsed),
        enqueueEmbed,
        logger,
      },
      { tenantId: TENANT, documentId: DOC },
    );
    expect(outcome).toEqual({ status: 'missing' });
    expect(enqueueEmbed).not.toHaveBeenCalled();
  });

  it('marks the document failed and rethrows when parsing throws (pg-boss retries)', async () => {
    const documents = new FakeDocumentRepo(doc);
    const throwingParser: PdfParserPort = { parse: () => Promise.reject(new Error('bad pdf')) };
    await expect(
      ingestDocumentJob(
        {
          documents,
          storage: fakeStorage(),
          parser: throwingParser,
          enqueueEmbed: vi.fn(),
          logger,
        },
        { tenantId: TENANT, documentId: DOC },
      ),
    ).rejects.toThrow('bad pdf');
    expect(documents.statuses).toEqual(['processing', 'failed']);
  });
  it('keeps committed extraction successful when embedding enqueue fails', async () => {
    const documents = new FakeDocumentRepo(doc);
    const outcome = await ingestDocumentJob(
      {
        documents,
        storage: fakeStorage(),
        parser: new FixtureParser(parsed),
        enqueueEmbed: vi.fn().mockRejectedValue(new Error('queue offline')),
        logger,
      },
      { tenantId: TENANT, documentId: DOC },
    );
    expect(outcome.status).toBe('ingested');
    expect(documents.statuses).not.toContain('failed');
  });
  it('excludes uncertain tables from AI evidence', async () => {
    const documents = new FakeDocumentRepo(doc);
    await ingestDocumentJob(
      {
        documents,
        storage: fakeStorage(),
        parser: new FixtureParser({
          ...parsed,
          blocks: [{ kind: 'table', text: '| A | B |', page: 1, confidence: 0.5 }],
        }),
        enqueueEmbed: vi.fn().mockResolvedValue(undefined),
        logger,
      },
      { tenantId: TENANT, documentId: DOC },
    );
    expect(documents.inserted?.[0]?.aiMayCite).toBe(false);
  });
  it('does not enqueue results from a stale processing claim', async () => {
    const documents = new FakeDocumentRepo(doc);
    vi.spyOn(documents, 'commitIngestion').mockResolvedValue(null as never);
    const enqueueEmbed = vi.fn();
    expect(
      await ingestDocumentJob(
        {
          documents,
          storage: fakeStorage(),
          parser: new FixtureParser(parsed),
          enqueueEmbed,
          logger,
        },
        { tenantId: TENANT, documentId: DOC },
      ),
    ).toEqual({ status: 'missing' });
    expect(enqueueEmbed).not.toHaveBeenCalled();
  });
});
