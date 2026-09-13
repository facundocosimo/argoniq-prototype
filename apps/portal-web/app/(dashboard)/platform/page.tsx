import { type JSX } from 'react';
import { PageContainer } from '@argoniq/ui';
import { PlatformConsole } from '../../../components/platform/platform-console.js';

/** Platform (super-admin) console — the Manufacturer registry. Guarded to the
 *  platform operator by `platform/layout.tsx`. */
export default function PlatformPage(): JSX.Element {
  return (
    <PageContainer>
      <PlatformConsole />
    </PageContainer>
  );
}
