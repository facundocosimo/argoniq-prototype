import { type JSX } from 'react';
import { roleSpaceOf } from '@argoniq/core-domain';
import { currentActor } from '../../../lib/trpc/context.js';
import { MachinesList } from '../../../components/manage/machines-list.js';
import { Boxes } from 'lucide-react';
import { EmptyState, PageContainer, Stack } from '@argoniq/ui';
import { serverQuery } from '../../../lib/trpc/server.js';
import { PageChrome } from '../../../lib/page-chrome.js';
import { InstalledBaseView } from '../../../components/installed-base-view.js';

/**
 * Machines (the installed base). A Server Component reading the whole
 * installed base through the tRPC server caller — lines with their stations and
 * standalone machines together, each with its year installed and a health status
 * derived from open service cases. The service applies tenant + customer scope, so
 * this view never decides access. Table ⇄ card display is a client toggle.
 */
export default async function MachinesPage(): Promise<JSX.Element> {
  const actor = await currentActor();
  if (actor && roleSpaceOf(actor.role) === 'oem_staff')
    return (
      <PageContainer>
        <MachinesList />
      </PageContainer>
    );
  const tree = await serverQuery((api) => api.machine.listInstalledBase({}));
  const isEmpty = tree.lines.length === 0 && tree.standalone.length === 0;

  return (
    <PageContainer>
      <PageChrome title="Machines" breadcrumbs={[{ label: 'Workspace' }, { label: 'Machines' }]} />
      <Stack gap={4}>
        {isEmpty ? (
          <EmptyState
            icon={<Boxes className="size-6" aria-hidden />}
            title="No machines yet"
            description="Machines appear here once they are registered to your account by your OEM."
          />
        ) : (
          <InstalledBaseView tree={tree} />
        )}
      </Stack>
    </PageContainer>
  );
}
