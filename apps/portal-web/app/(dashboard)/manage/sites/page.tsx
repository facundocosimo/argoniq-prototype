import { type JSX } from 'react';
import { PageContainer } from '@argoniq/ui';
import { SitesList } from '../../../../components/manage/sites-list.js';

/** OEM control center — sites list. Guarded to OEM staff. */
export default function ManageSitesPage(): JSX.Element {
  return (
    <PageContainer>
      <SitesList />
    </PageContainer>
  );
}
