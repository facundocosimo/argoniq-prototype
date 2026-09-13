import { type JSX } from 'react';
import { PageContainer } from '@argoniq/ui';
import { ModelEditor } from '../../../../../components/manage/model-editor.js';

/**
 * Catalog Studio — create or edit one model + its variant axes and option catalog.
 * `id === 'new'` is create; the owning family arrives as `?familyId=`.
 */
export default async function ManageModelEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ familyId?: string; name?: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  const { familyId, name } = await searchParams;
  return (
    <PageContainer>
      <ModelEditor id={id} familyId={familyId} name={name} />
    </PageContainer>
  );
}
