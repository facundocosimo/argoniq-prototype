import { type JSX } from 'react';
import { PageContainer } from '@argoniq/ui';
import { ContactsList } from '../../../../components/manage/contacts-list.js';

/** OEM control center — contacts list (the CRM address book). Guarded to OEM staff by `manage/layout.tsx`. */
export default function ManageContactsPage(): JSX.Element {
  return (
    <PageContainer>
      <ContactsList />
    </PageContainer>
  );
}
