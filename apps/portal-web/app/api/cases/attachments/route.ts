import { MAX_CASE_FILE_BYTES } from '@argoniq/core-domain';
import { getEnv } from '@argoniq/core-domain/env';
import { uploadCaseAttachment } from '@argoniq/core';
import { isAppError } from '@argoniq/observability';
import { createTRPCContext } from '../../../../lib/trpc/context.js';

export async function POST(request: Request): Promise<Response> {
  const { service } = await createTRPCContext();
  if (!service) return Response.json({ error: 'Sign in to attach files.' }, { status: 403 });
  if (
    ![getEnv().APP_URL, ...getEnv().ALLOWED_ORIGINS].includes(request.headers.get('origin') ?? '')
  )
    return Response.json({ error: 'Upload must originate from this workspace.' }, { status: 403 });
  try {
    service.policy.assertCan('create', 'Case');
    const max = MAX_CASE_FILE_BYTES + 128 * 1024;
    if (Number(request.headers.get('content-length') ?? 0) > max)
      return Response.json({ error: 'File exceeds 10 MB.' }, { status: 413 });
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: 'Choose a file.' }, { status: 400 });
    const parts: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        return Response.json({ error: 'File exceeds 10 MB.' }, { status: 413 });
      }
      parts.push(value);
    }
    const form = await new Response(Buffer.concat(parts), {
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
    }).formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ error: 'Choose a file.' }, { status: 400 });
    const row = await uploadCaseAttachment(
      service,
      { serialId: form.get('serialId'), submissionKey: form.get('submissionKey') },
      { filename: file.name, bytes: new Uint8Array(await file.arrayBuffer()) },
    );
    return Response.json(row);
  } catch (error) {
    const status = isAppError(error)
      ? ({ VALIDATION: 400, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409 }[
          error.code as 'VALIDATION'
        ] ?? 500)
      : 500;
    return Response.json(
      {
        error:
          isAppError(error) && error.expose
            ? error.message
            : 'Could not attach this file. Try again.',
      },
      { status },
    );
  }
}
