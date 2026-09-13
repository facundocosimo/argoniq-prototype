import { type JSX } from 'react';
import { PageContainer } from '@argoniq/ui';
import { SiteEditor } from '../../../../../components/manage/site-editor.js';

/** OEM control center — create or edit one site. `id === 'new'` is create; a `?companyId=`
 *  pre-selects the owning customer (e.g. when created from a customer's account hub). */
export default async function ManageSiteEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ companyId?: string; name?: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  const { companyId, name } = await searchParams;
  return (
    <PageContainer>
      <SiteEditor id={id} companyId={companyId} name={name} />
    </PageContainer>
  );
}
