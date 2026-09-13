import { type JSX } from 'react';
import { PageContainer } from '@argoniq/ui';
import { AxisEditor } from '../../../../../../components/manage/axis-editor.js';

/**
 * Catalog Studio — create or edit one variant axis. `id === 'new'` is create; the
 * owning model arrives as `?modelId=`.
 */
export default async function ManageAxisEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ modelId?: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  const { modelId } = await searchParams;
  return (
    <PageContainer>
      <AxisEditor id={id} modelId={modelId} />
    </PageContainer>
  );
}
