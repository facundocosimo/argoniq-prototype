import { getEnv } from '@argoniq/core-domain/env';
import { MAX_DOCUMENT_BYTES, uploadDocument } from '@argoniq/core';
import { getLogger, isAppError, runWithNewContext } from '@argoniq/observability';
import { createTRPCContext } from '../../../../lib/trpc/context.js';

/**
 * Multipart document-upload transport. tRPC is JSON-only, so the binary file rides a
 * dedicated route while metadata comes as form fields; it then calls the same
 * `uploadDocument` service (validate→authorize→store→enqueue→audit) as any other
 * transport would. Runs inside `runWithNewContext` for correlated logs/audit, mirroring
 * the tRPC route. Only a tenant principal (OEM staff) may upload — the platform
 * operator and unauthenticated requests are rejected before any work.
 */
const logger = getLogger({ transport: 'documents-upload' });

const OPTIONAL_FIELDS = [
  'category',
  'familyId',
  'modelId',
  'companyId',
  'serialId',
  'installationId',
  'docKey',
  'revisionLabel',
  'language',
  'uploadKey',
  'previousDocumentId',
] as const;

export async function POST(request: Request): Promise<Response> {
  const ctx = await createTRPCContext();
  if (!ctx.service) {
    return Response.json({ error: 'not authorized to upload documents' }, { status: 403 });
  }
  const service = ctx.service;

  return runWithNewContext(
    { tenantId: service.tenantId, userId: service.actor.userId },
    async () => {
      try {
        service.policy.assertCan('create', 'Document');
        if (
          ![getEnv().APP_URL, ...getEnv().ALLOWED_ORIGINS].includes(
            request.headers.get('origin') ?? '',
          )
        ) {
          return Response.json(
            { error: 'Upload must originate from this workspace.' },
            { status: 403 },
          );
        }
        const maxBody = MAX_DOCUMENT_BYTES + 128 * 1024;
        if (Number(request.headers.get('content-length') ?? 0) > maxBody)
          return Response.json({ error: 'PDF exceeds 40 MB.' }, { status: 413 });
        const reader = request.body?.getReader();
        if (!reader) return Response.json({ error: 'Missing upload body.' }, { status: 400 });
        const parts: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBody) {
            await reader.cancel();
            return Response.json({ error: 'PDF exceeds 40 MB.' }, { status: 413 });
          }
          parts.push(value);
        }
        const boundedBody = Buffer.concat(parts);
        const form = await new Response(boundedBody, {
          headers: { 'content-type': request.headers.get('content-type') ?? '' },
        }).formData();
        const file = form.get('file');
        if (!(file instanceof File)) {
          return Response.json({ error: 'missing file' }, { status: 400 });
        }
        const str = (value: FormDataEntryValue | null): string | undefined =>
          typeof value === 'string' && value.length > 0 ? value : undefined;
        const meta: Record<string, unknown> = {
          title: str(form.get('title')) ?? file.name,
          tier: str(form.get('tier')) ?? 'T1',
          sourceType: str(form.get('sourceType')) ?? 'manual_pdf',
        };
        for (const key of OPTIONAL_FIELDS) {
          const value = form.get(key);
          if (typeof value === 'string' && value.length > 0) meta[key] = value;
        }

        meta.indexable = form.get('indexable') !== 'false';
        const bytes = new Uint8Array(await file.arrayBuffer());
        const row = await uploadDocument(
          service,
          { bytes, filename: file.name, contentType: file.type || 'application/pdf' },
          meta,
        );
        return Response.json({ id: row.id, title: row.title, status: row.status });
      } catch (error) {
        logger.error({ err: error }, 'document upload failed');
        const status = isAppError(error)
          ? ((
              { VALIDATION: 400, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409 } as Record<
                string,
                number
              >
            )[error.code] ?? 500)
          : 500;
        const message = isAppError(error) && error.expose ? error.message : 'upload failed';
        return Response.json({ error: message }, { status });
      }
    },
  );
}
