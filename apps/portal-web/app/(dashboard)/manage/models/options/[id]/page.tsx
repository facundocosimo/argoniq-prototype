import { type JSX } from 'react';
import { PageContainer } from '@argoniq/ui';
import { OptionEditor } from '../../../../../../components/manage/option-editor.js';

/**
 * Catalog Studio — create or edit one equipment option. `id === 'new'` is create; the
 * owning model arrives as `?modelId=`.
 */
export default async function ManageCatalogOptionPage({
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
      <OptionEditor id={id} modelId={modelId} />
    </PageContainer>
  );
}
