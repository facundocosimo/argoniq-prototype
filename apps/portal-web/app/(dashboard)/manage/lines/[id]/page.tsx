import { type JSX } from 'react';
import { PageContainer } from '@argoniq/ui';
import { LineEditor } from '../../../../../components/manage/line-editor.js';

/** OEM control center — create or edit one line + assign stations. `id === 'new'` is create. */
export default async function ManageLineEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  return (
    <PageContainer>
      <LineEditor id={id} />
    </PageContainer>
  );
}
