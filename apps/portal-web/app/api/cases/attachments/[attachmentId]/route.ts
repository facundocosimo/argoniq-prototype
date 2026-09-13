import { downloadCaseAttachment } from '@argoniq/core';
import { isAppError } from '@argoniq/observability';
import { createTRPCContext } from '../../../../../lib/trpc/context.js';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
): Promise<Response> {
  const { service } = await createTRPCContext();
  if (!service) return new Response('Sign in to download evidence.', { status: 403 });
  try {
    const file = await downloadCaseAttachment(service, await params);
    return new Response(Buffer.from(file.bytes), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        'Content-Length': String(file.bytes.length),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    const status =
      isAppError(error) && error.code === 'FORBIDDEN'
        ? 403
        : isAppError(error) && error.code === 'NOT_FOUND'
          ? 404
          : 500;
    return new Response('Attachment unavailable.', { status });
  }
}
