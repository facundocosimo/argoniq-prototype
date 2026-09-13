import { type JSX } from 'react';
import { PageContainer } from '@argoniq/ui';
import { ContactEditor } from '../../../../../components/manage/contact-editor.js';

/** OEM control center — create or edit one contact. `id === 'new'` is create; `?companyId=`
 *  (and optional `?siteId=`) pre-select the owner when created from a customer or site record. */
export default async function ManageContactEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ companyId?: string; siteId?: string; name?: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  const { companyId, siteId, name } = await searchParams;
  return (
    <PageContainer>
      <ContactEditor id={id} companyId={companyId} siteId={siteId} name={name} />
    </PageContainer>
  );
}
