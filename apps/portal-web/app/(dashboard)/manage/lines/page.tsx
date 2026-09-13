import { type JSX } from 'react';
import { PageContainer } from '@argoniq/ui';
import { LinesList } from '../../../../components/manage/lines-list.js';

/** OEM control center — lines list. Guarded to OEM staff. */
export default function ManageLinesPage(): JSX.Element {
  return (
    <PageContainer>
      <LinesList />
    </PageContainer>
  );
}
