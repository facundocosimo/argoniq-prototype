import { type JSX } from 'react';
import { PageContainer } from '@argoniq/ui';
import { FamilyEditor } from '../../../../../../components/manage/family-editor.js';

/** Catalog Studio — create or edit one machine family + its models. `id === 'new'` is create. */
export default async function ManageFamilyEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ name?: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  const { name } = await searchParams;
  return (
    <PageContainer>
      <FamilyEditor id={id} name={name} />
    </PageContainer>
  );
}
