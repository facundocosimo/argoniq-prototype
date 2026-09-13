import { and, eq, inArray } from 'drizzle-orm';
import {
  ChatSupportDraft,
  SupportDraftInput,
  SupportDraftExtraction,
  type SupportSource,
} from '@argoniq/core-domain';
import { documents, type TenantTransaction } from '@argoniq/db';
import { resolveLlmPort, type LlmPort } from '@argoniq/intelligence/llm';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { authorizedCaseMachine } from './attachments.js';
import { readableDocument } from '../document/eligibility.js';
import { type z } from 'zod';

/** Re-read titles and eligibility; never trust client/model citation labels or URLs. */
export async function supportSources(
  ctx: ServiceContext,
  tx: TenantTransaction,
  serialId: string,
  companyId: string,
  candidates: { documentId: string; page?: number | undefined }[],
): Promise<z.infer<typeof SupportSource>[]> {
  const result: z.infer<typeof SupportSource>[] = [];
  for (const candidate of candidates) {
    const [row] = await tx
      .select({
        id: documents.id,
        title: documents.title,
        pageCount: documents.pageCount,
        tier: documents.tier,
        companyId: documents.companyId,
      })
      .from(documents)
      .where(
        and(
          eq(documents.id, candidate.documentId),
          readableDocument(ctx, { serialId }),
          inArray(documents.tier, ['T1', 'T2']),
        ),
      )
      .limit(1);
    if (
      !row ||
      (row.tier === 'T2' && row.companyId !== companyId) ||
      (candidate.page && (!row.pageCount || candidate.page > row.pageCount))
    )
      continue;
    if (result.some((s) => s.documentId === row.id && s.page === candidate.page)) continue;
    result.push({
      documentId: row.id,
      title: row.title,
      ...(candidate.page ? { page: candidate.page } : {}),
    });
  }
  return result;
}
/** Read-only draft preparation. The sole write boundary remains confirmed case.create. */
export async function prepareCaseDraft(
  ctx: ServiceContext,
  input: unknown,
  llm?: LlmPort,
): Promise<ChatSupportDraft> {
  const data = parseInput(SupportDraftInput, input);
  const sources = await ctx.withTenant(async (tx) => {
    const machine = await authorizedCaseMachine(ctx, tx, data.serialId);
    return supportSources(ctx, tx, machine.id, machine.companyId, data.sources);
  });
  const userMessages = data.history.filter((t) => t.role === 'user').map((t) => t.text);
  const fallback: ChatSupportDraft = {
    serialId: data.serialId,
    summary: userMessages.join('\n\n').slice(0, 4000),
    fields: {},
    sources,
    preparation: 'verbatim',
  };
  try {
    const provider = llm ?? resolveLlmPort(ctx.logger);
    if (!provider.prepareSupportDraft) return fallback;
    const extracted = SupportDraftExtraction.parse(
      await provider.prepareSupportDraft({ history: data.history }),
    );
    const fields: Record<string, string> = {};
    for (const field of extracted.fields) {
      // A proposed field without actual user evidence cannot prepopulate the form.
      if (!userMessages.some((text) => text.includes(field.quote))) continue;
      const parsed = ChatSupportDraft.shape.fields.shape[field.field].safeParse(field.value);
      if (parsed.success && parsed.data !== undefined) fields[field.field] = parsed.data;
    }
    return ChatSupportDraft.parse({
      ...fallback,
      summary: extracted.summary,
      fields,
      preparation: 'assisted',
    });
  } catch {
    ctx.logger.warn('support draft preparation unavailable; preserving user wording');
    return fallback;
  }
}
