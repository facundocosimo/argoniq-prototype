import { z } from 'zod';
import { DOCUMENT_CATEGORIES, DocumentId, DocumentScope } from '@argoniq/core-domain';
export const DocumentMetadata = z
  .object({
    title: z.string().trim().min(1).max(400),
    tier: z.enum(['T1', 'T2', 'T3']),
    sourceType: z.literal('manual_pdf').default('manual_pdf'),
    category: z.enum(DOCUMENT_CATEGORIES).default('operation'),
    indexable: z.boolean().default(true),
    docKey: z.string().trim().min(1).max(120),
    revisionLabel: z.string().trim().min(1).max(40),
    language: z.enum(['en', 'it']),
  })
  .and(DocumentScope);
export const UploadDocumentMeta = DocumentMetadata.and(
  z.object({
    uploadKey: z.string().uuid(),
    previousDocumentId: DocumentId.optional(),
  }),
);
export type UploadDocumentMeta = z.infer<typeof UploadDocumentMeta>;
export const REVISION_IDENTITY_FIELDS = [
  'tier',
  'familyId',
  'modelId',
  'companyId',
  'serialId',
  'installationId',
  'docKey',
  'language',
] as const;
