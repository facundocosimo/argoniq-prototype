import { type JSX } from 'react';
import { PageContainer } from '@argoniq/ui';
import { CompanyEditor } from '../../../../../components/manage/company-editor.js';

/** OEM control center — create or edit one customer. `id === 'new'` is create. */
export default async function ManageCompanyEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ name?: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  const { name } = await searchParams;
  return (
    <PageContainer>
      <CompanyEditor id={id} name={name} />
    </PageContainer>
  );
}
