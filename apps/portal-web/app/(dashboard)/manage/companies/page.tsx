import { type JSX } from 'react';
import { PageContainer } from '@argoniq/ui';
import { CompaniesList } from '../../../../components/manage/companies-list.js';

/** OEM control center — companies list. Guarded to OEM staff by `manage/layout.tsx`. */
export default function ManageCompaniesPage(): JSX.Element {
  return (
    <PageContainer>
      <CompaniesList />
    </PageContainer>
  );
}
