import { ChatSupportDraft } from '@argoniq/core-domain';

export function caseDraftKey(scope: string, serialId: string | undefined, draftId?: string) {
  return `argoniq:case-draft:${scope}:${serialId ?? 'new'}${draftId ? `:chat:${draftId}` : ''}`;
}
/** Each chat handoff has its own key: never replace another report's edits or attachments. */
export function saveChatSupportDraft(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  scope: string,
  draftId: string,
  input: ChatSupportDraft,
) {
  const draft = ChatSupportDraft.parse(input);
  const key = caseDraftKey(scope, draft.serialId, draftId);
  if (storage.getItem(key)) return;
  storage.setItem(
    key,
    JSON.stringify({
      serialId: draft.serialId,
      submissionKey: draftId,
      summary: draft.summary,
      report: { ...draft.fields, sourceReferences: draft.sources, preparedFromChat: true },
      preparation: draft.preparation,
    }),
  );
}
