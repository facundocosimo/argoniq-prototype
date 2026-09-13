import {
  GetDocumentInput,
  PreviewUploadScopeInput,
  previewUploadScope,
  PreviewDocumentScopeInput,
  previewDocumentScope,
  UpdateDocumentInput,
  TransitionDocumentInput,
  ReviewExtractionInput,
  ReviewChunkInput,
  updateDocument,
  transitionDocument,
  reviewExtraction,
  reviewChunk,
  ListDocumentsInput,
  PreviewApplicabilityInput,
  ReprocessDocumentInput,
  getDocumentDetail,
  listDocuments,
  previewSerialApplicability,
  reprocessDocument,
} from '../../../services/document/index.js';
import { protectedProcedure, router } from '../trpc.js';

/**
 * Document router — thin adapter over the document service. Binary UPLOAD is handled by
 * a dedicated multipart route handler (`/api/documents/upload`), not tRPC; everything
 * else (list, reprocess) goes through here.
 */
export const documentRouter = router({
  previewUploadScope: protectedProcedure
    .input(PreviewUploadScopeInput)
    .query(({ ctx, input }) => previewUploadScope(ctx.service, input)),
  previewScope: protectedProcedure
    .input(PreviewDocumentScopeInput)
    .query(({ ctx, input }) => previewDocumentScope(ctx.service, input)),
  update: protectedProcedure
    .input(UpdateDocumentInput)
    .mutation(({ ctx, input }) => updateDocument(ctx.service, input)),
  transition: protectedProcedure
    .input(TransitionDocumentInput)
    .mutation(({ ctx, input }) => transitionDocument(ctx.service, input)),
  extraction: protectedProcedure
    .input(ReviewExtractionInput)
    .query(({ ctx, input }) => reviewExtraction(ctx.service, input)),
  reviewChunk: protectedProcedure
    .input(ReviewChunkInput)
    .mutation(({ ctx, input }) => reviewChunk(ctx.service, input)),
  list: protectedProcedure
    .input(ListDocumentsInput)
    .query(({ ctx, input }) => listDocuments(ctx.service, input)),
  get: protectedProcedure
    .input(GetDocumentInput)
    .query(({ ctx, input }) => getDocumentDetail(ctx.service, input)),
  reprocess: protectedProcedure
    .input(ReprocessDocumentInput)
    .mutation(({ ctx, input }) => reprocessDocument(ctx.service, input)),
  /** OEM resolve-preview: which current documents apply to a serial, with channel annotations. */
  previewApplicability: protectedProcedure
    .input(PreviewApplicabilityInput)
    .query(({ ctx, input }) => previewSerialApplicability(ctx.service, input)),
});
