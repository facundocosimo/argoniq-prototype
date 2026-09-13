import { resolveReadableStorageKey, resolveStoragePort } from '@argoniq/core';
import { getLogger, runWithNewContext } from '@argoniq/observability';
import { createTRPCContext } from '../../../../lib/trpc/context.js';

/**
 * Document source download. The storage key is tenant-prefixed
 * (`tenants/<tenantId>/documents/<documentId>/source.pdf`); the route enforces TWO
 * gates before streaming a byte: (1) the key's tenant segment must equal the actor's
 * tenant, and (2) the document behind it must be one the actor may READ (tier +
 * customer scope) — so a customer can never pull a T3/T4 source or another customer's
 * T2 file even with a guessed key. Failures are an opaque 404, never a distinguishable
 * "forbidden", to avoid leaking existence.
 */
const logger = getLogger({ transport: 'storage-download' });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const ctx = await createTRPCContext();
  if (!ctx.service) return new Response('Not found', { status: 404 });
  const service = ctx.service;

  const key = (await params).key.join('/');
  const notFound = new Response('Not found', { status: 404 });

  return runWithNewContext(
    { tenantId: service.tenantId, userId: service.actor.userId },
    async () => {
      // Gate 1: the key must live under the actor's own tenant prefix.
      const segments = key.split('/');
      if (segments[0] !== 'tenants' || segments[1] !== service.tenantId) return notFound;
      const documentId = segments[3];
      if (!documentId) return notFound;

      try {
        // Gate 2: the document must be readable by this actor, and the requested key must
        // match the one on record (no reading a sibling doc's bytes through a crafted key).
        const readable = await resolveReadableStorageKey(service, documentId);
        if (readable?.storageKey !== key) return notFound;

        const bytes = await resolveStoragePort().get(key);
        const isPdf = readable.mimeType === 'application/pdf';
        // A Uint8Array is a valid runtime BodyInit (undici/Node); the cast bridges the
        // TS lib's over-strict ArrayBufferLike→ArrayBuffer narrowing for Response bodies.
        return new Response(bytes as unknown as BodyInit, {
          headers: {
            'content-type': isPdf ? 'application/pdf' : 'application/octet-stream',
            'content-length': String(bytes.byteLength),
            // Only PDFs are previewed inline. Reference files must not execute uploaded
            // HTML/SVG or other active content on the authenticated application's origin.
            'content-disposition': `${isPdf ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(readable.filename ?? 'document.pdf')}`,
            'x-content-type-options': 'nosniff',
            'cache-control': 'private, no-store',
            'content-security-policy': "sandbox; default-src 'none'; frame-ancestors 'self'",
          },
        });
      } catch (error) {
        logger.error({ err: error, key }, 'storage download failed');
        return notFound;
      }
    },
  );
}
