import { type JSX } from 'react';
import { PageContainer } from '@argoniq/ui';
import { ModelsList } from '../../../../components/manage/models-list.js';
import { serverQuery } from '../../../../lib/trpc/server.js';

/** Catalog Studio — the machine families registry, the top of the product catalog. */
export default async function ModelsPage(): Promise<JSX.Element> {
  const families = await serverQuery((api) => api.management.listFamilies());
  const models = (
    await Promise.all(
      families.map(async (family) =>
        (await serverQuery((api) => api.management.listModels({ familyId: family.id }))).map(
          (model) => ({ ...model, familyName: family.name }),
        ),
      ),
    )
  ).flat();
  return (
    <PageContainer>
      <ModelsList models={models} />
    </PageContainer>
  );
}
