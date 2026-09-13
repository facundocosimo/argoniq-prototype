import { type JSX } from 'react';
import { PageContainer } from '@argoniq/ui';
import { FamiliesList } from '../../../../../components/manage/families-list.js';

export default function FamiliesPage(): JSX.Element {
  return (
    <PageContainer>
      <FamiliesList />
    </PageContainer>
  );
}
