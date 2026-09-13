import { type TenantId } from '@argoniq/core-domain';
import { type DocumentRepository } from '@argoniq/db';
import { type PdfParserPort, chunkDocument } from '@argoniq/intelligence/ingestion';
import { IngestDocumentPayload } from '@argoniq/jobs';
import { type Logger } from '@argoniq/observability';
import { type StoragePort } from '@argoniq/storage';

export type IngestDocumentDeps = {
  readonly documents: DocumentRepository;
  readonly storage: StoragePort;
  readonly parser: PdfParserPort;
  /** Enqueue one chunk for embedding (the dense half of the hybrid index). */
  readonly enqueueEmbed: (payload: { tenantId: TenantId; chunkId: string }) => Promise<void>;
  readonly logger: Logger;
};

export type IngestDocumentOutcome =
  | { readonly status: 'ingested'; readonly chunks: number; readonly pages: number }
  | { readonly status: 'missing' }
  | { readonly status: 'needs_review'; readonly pages: number };

/** Claim a draft, parse its immutable PDF and commit extraction under that claim.
 * Duplicate/stale jobs cannot replace chunks. Publication is a separate reviewed
 * action. Missing embedding jobs are recovered from persisted chunks by the worker. */
export async function ingestDocumentJob(
  deps: IngestDocumentDeps,
  rawPayload: unknown,
): Promise<IngestDocumentOutcome> {
  const { tenantId, documentId } = IngestDocumentPayload.parse(rawPayload);
  const { documents, storage, parser, enqueueEmbed, logger } = deps;

  const doc = await documents.claimIngestion(tenantId, documentId);
  if (!doc) {
    logger.warn({ documentId }, 'ingest-document: document not found; nothing to do');
    return { status: 'missing' };
  }

  try {
    const bytes = await storage.get(doc.storageKey);
    const parsed = await parser.parse(bytes, doc.title);
    const drafts = chunkDocument(parsed, { docTitle: doc.title });

    const chunkIds = await documents.commitIngestion(
      tenantId,
      documentId,
      doc.token,
      drafts.map((d) => ({
        chunkIndex: d.chunkIndex,
        chunkType: d.chunkType,
        page: d.page,
        pageEnd: d.pageEnd,
        sectionPath: d.sectionPath,
        sectionTitle: d.sectionTitle,
        content: d.content,
        contextualText: d.contextualText,
        // Inherit the document tier's citing default; a low-confidence chunk stays
        // usable-for-reasoning but the review queue can flip these per chunk later.
        aiMayCite: !d.needsEnrichment,
        forbiddenForCustomerFacing: false,
      })),
      {
        pages: parsed.pageCount,
        textPages: new Set(parsed.blocks.filter((b) => b.text.trim()).map((b) => b.page)).size,
        reviewChunks: drafts.filter((d) => d.needsEnrichment).length,
      },
    );
    if (!chunkIds) return { status: 'missing' };
    if (!chunkIds.length) return { status: 'needs_review', pages: parsed.pageCount };

    for (const chunkId of chunkIds) {
      await enqueueEmbed({ tenantId, chunkId }).catch((error) =>
        logger.error({ err: error, chunkId }, 'embedding enqueue pending recovery'),
      );
    }

    logger.info(
      { documentId, chunks: chunkIds.length, pages: parsed.pageCount },
      'ingest-document: ingested',
    );
    return { status: 'ingested', chunks: chunkIds.length, pages: parsed.pageCount };
  } catch (error) {
    await documents.failIngestion(
      tenantId,
      documentId,
      doc.token,
      'PDF processing failed. Check that the file opens and is not password-protected, then retry.',
    );
    logger.error({ documentId, err: error }, 'ingest-document: failed');
    throw error;
  }
}
