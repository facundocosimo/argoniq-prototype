import { type JSX } from 'react';
import { PageContainer } from '@argoniq/ui';
import { MachineEditor } from '../../../../../components/manage/machine-editor.js';

/** OEM control center — create or edit one installed machine. `id === 'new'` is create; a
 *  `?companyId=` pre-selects the owning customer (e.g. from a customer's account hub). */
export default async function ManageMachineEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ companyId?: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  const { companyId } = await searchParams;
  return (
    <PageContainer>
      <MachineEditor id={id} companyId={companyId} />
    </PageContainer>
  );
}
