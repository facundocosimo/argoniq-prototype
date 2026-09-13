'use client';
import { type JSX, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CompanyId,
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  DocumentId,
  MachineFamilyId,
  MachineModelId,
  SerialId,
  InstallationId,
  type DocumentCategory,
} from '@argoniq/core-domain';
import type { DocumentListItem } from '@argoniq/core';
import { Button, Input, Label, Select, Text } from '@argoniq/ui';
import { trpc } from '../lib/trpc/client.js';

export interface FamilyOption {
  readonly id: string;
  readonly name: string;
}
export interface ModelOption {
  readonly id: string;
  readonly familyId: string;
  readonly name: string;
}
type Initial = Partial<
  Pick<
    DocumentListItem,
    | 'id'
    | 'title'
    | 'tier'
    | 'category'
    | 'docKey'
    | 'revisionLabel'
    | 'language'
    | 'familyId'
    | 'modelId'
    | 'companyId'
    | 'serialId'
    | 'installationId'
    | 'indexable'
    | 'updatedAt'
  >
>;

/** Shared upload/draft editor. Failed submissions retain fields and source selection. */
export function DocumentUploader({
  families,
  models,
  initiallyExpanded = false,
  initial = {},
  mode = 'upload',
  onSaved,
}: {
  readonly families: readonly FamilyOption[];
  readonly models: readonly ModelOption[];
  readonly initiallyExpanded?: boolean;
  readonly initial?: Initial;
  readonly mode?: 'upload' | 'revision' | 'edit';
  readonly onSaved?: () => void;
}): JSX.Element {
  const router = useRouter();
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [familyId, setFamilyId] = useState(initial.familyId ?? '');
  const [modelId, setModelId] = useState(initial.modelId ?? '');
  const [companyId, setCompanyId] = useState(initial.companyId ?? '');
  const [installationId, setInstallationId] = useState(initial.installationId ?? '');
  const [preview, setPreview] = useState<
    { id: string; serialNumber: string; companyName: string; total: number }[] | null
  >(null);
  const utils = trpc.useUtils();
  const [serialId, setSerialId] = useState(initial.serialId ?? '');
  const [tier, setTier] = useState(initial.tier ?? 'T1');
  const [indexable, setIndexable] = useState(initial.indexable ?? true);
  const uploadKey = useRef('');
  const requestSignature = useRef('');
  const update = trpc.document.update.useMutation();
  const companies = trpc.management.listCompanies.useInfiniteQuery(
    { limit: 100 },
    {
      enabled: expanded && tier === 'T2',
      getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    },
  );
  const machines = trpc.machine.listSerials.useInfiniteQuery(
    { limit: 100, ...(companyId ? { companyId: CompanyId.parse(companyId) } : {}) },
    {
      enabled: expanded && tier === 'T2' && !!companyId,
      getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    },
  );
  const installations = trpc.installation.list.useQuery(
    companyId ? { companyId: CompanyId.parse(companyId) } : {},
    { enabled: expanded && tier === 'T2' && !!companyId },
  );
  const companyOptions = companies.data?.pages.flatMap((page) => page.items) ?? [];
  const machineOptions = (machines.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (machine) =>
      (!familyId || machine.familyId === familyId) &&
      (!modelId || machine.modelId === modelId) &&
      (!installationId || machine.installationId === installationId),
  );
  const locked = mode === 'revision';

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    const string = (name: string) => {
      const value = data.get(name);
      return typeof value === 'string' ? value.trim() : '';
    };
    const metadata = {
      title: string('title'),
      docKey: string('docKey'),
      revisionLabel: string('revisionLabel'),
      language: string('language') as 'en' | 'it',
      tier: tier as 'T1' | 'T2' | 'T3',
      sourceType: 'manual_pdf' as const,
      category: string('category') as DocumentCategory,
      indexable,
      familyId: familyId ? MachineFamilyId.parse(familyId) : null,
      modelId: modelId ? MachineModelId.parse(modelId) : null,
      companyId: tier === 'T2' && companyId ? CompanyId.parse(companyId) : null,
      serialId: tier === 'T2' && serialId ? SerialId.parse(serialId) : null,
      installationId: tier === 'T2' && installationId ? InstallationId.parse(installationId) : null,
    };
    setBusy(true);
    try {
      if (
        ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value ===
        'preview'
      ) {
        setPreview(await utils.document.previewUploadScope.fetch(metadata));
        return;
      }
      if (mode === 'edit' && initial.id && initial.updatedAt) {
        await update.mutateAsync({
          ...metadata,
          documentId: DocumentId.parse(initial.id),
          updatedAt: initial.updatedAt,
        });
        onSaved?.();
        router.refresh();
        return;
      }
      const file = data.get('file');
      if (!(file instanceof File) || !file.size || file.size > 40 * 1024 * 1024)
        throw new Error('Choose a PDF up to 40 MB.');
      const signature = JSON.stringify({
        metadata,
        filename: file.name,
        size: file.size,
        modified: file.lastModified,
      });
      if (requestSignature.current !== signature) {
        uploadKey.current = crypto.randomUUID();
        requestSignature.current = signature;
      }
      for (const [key, value] of Object.entries(metadata)) {
        data.delete(key);
        if (value !== null) data.set(key, String(value));
      }
      data.set('uploadKey', uploadKey.current);
      if (mode === 'revision' && initial.id) data.set('previousDocumentId', initial.id);
      const response = await fetch('/api/documents/upload', { method: 'POST', body: data });
      const body = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !body.id)
        throw new Error(
          body.error ?? 'Upload failed. Your draft is preserved; retry when connected.',
        );
      router.push(`/technical-information/${body.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }
  if (!expanded)
    return (
      <Button variant="secondary" onClick={() => setExpanded(true)}>
        Upload document
      </Button>
    );
  return (
    <form
      onChangeCapture={() => setPreview(null)}
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-4"
    >
      <Text tone="muted">
        PDF up to 40 MB. AI extraction supports selectable text in English and Italian, up to 1,000
        pages. Scans and drawings can be kept as reference only. Uploads start as private drafts.
      </Text>
      {initial.serialId && (
        <Text>Machine scope is inherited from this machine. Company-specific access applies.</Text>
      )}
      {locked && (
        <Text>
          New revision of {initial.docKey}. Identity, language and applicability are inherited; the
          current approved source remains available during review.
        </Text>
      )}
      <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
        {mode !== 'edit' && (
          <div className="sm:col-span-2">
            <Label htmlFor="doc-file">PDF file</Label>
            <Input id="doc-file" name="file" type="file" accept="application/pdf,.pdf" required />
          </div>
        )}
        <div className="sm:col-span-2">
          <Label htmlFor="doc-title">Title</Label>
          <Input
            id="doc-title"
            name="title"
            required
            maxLength={400}
            defaultValue={initial.title ?? ''}
          />
        </div>
        <div>
          <Label htmlFor="doc-key">Document identity / part number</Label>
          <Input
            id="doc-key"
            name="docKey"
            required
            maxLength={120}
            readOnly={locked}
            defaultValue={initial.docKey ?? ''}
          />
        </div>
        <div>
          <Label htmlFor="doc-revision">Revision</Label>
          <Input
            id="doc-revision"
            name="revisionLabel"
            required
            maxLength={40}
            defaultValue={mode === 'revision' ? '' : (initial.revisionLabel ?? 'A')}
          />
        </div>
        <div>
          <Label htmlFor="doc-language">Source language</Label>
          <Select
            id="doc-language"
            name="language"
            defaultValue={initial.language ?? 'en'}
            disabled={locked}
          >
            <option value="en">English</option>
            <option value="it">Italiano</option>
          </Select>
          {locked && <input type="hidden" name="language" value={initial.language ?? 'en'} />}
        </div>
        <div>
          <Label htmlFor="doc-category">Category</Label>
          <Select id="doc-category" name="category" defaultValue={initial.category ?? 'operation'}>
            {DOCUMENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {DOCUMENT_CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="doc-audience">Audience</Label>
          <Select
            id="doc-audience"
            value={tier}
            disabled={locked}
            onChange={(event) => {
              setTier(event.target.value as typeof tier);
              setCompanyId('');
              setSerialId('');
              setInstallationId('');
            }}
          >
            <option value="T1">Customers</option>
            <option value="T2">Company-specific</option>
            <option value="T3">Internal service team</option>
          </Select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={indexable}
            onChange={(event) => setIndexable(event.target.checked)}
          />
          Extract text for reviewed AI use
        </label>
        <div>
          <Label htmlFor="doc-family">Family</Label>
          <Select
            id="doc-family"
            value={familyId}
            disabled={locked}
            onChange={(event) => {
              setFamilyId(event.target.value);
              setModelId('');
              setSerialId('');
            }}
          >
            <option value="">All families</option>
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="doc-model">Model</Label>
          <Select
            id="doc-model"
            value={modelId}
            disabled={locked}
            onChange={(event) => {
              setModelId(event.target.value);
              setSerialId('');
            }}
          >
            <option value="">All models in scope</option>
            {models
              .filter((m) => !familyId || m.familyId === familyId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </Select>
        </div>
        {tier === 'T2' && (
          <>
            <div>
              <Label htmlFor="doc-installation">Line / installation</Label>
              <Select
                id="doc-installation"
                value={installationId}
                disabled={locked || !companyId}
                onChange={(event) => {
                  setInstallationId(event.target.value);
                  setSerialId('');
                }}
              >
                <option value="">All installations in scope</option>
                {installationId && !installations.data?.some((i) => i.id === installationId) && (
                  <option value={installationId}>Inherited installation</option>
                )}
                {installations.data?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="doc-company">Company</Label>
              <Select
                id="doc-company"
                required
                value={companyId}
                disabled={locked}
                onChange={(event) => {
                  setCompanyId(event.target.value);
                  setSerialId('');
                  setInstallationId('');
                }}
              >
                <option value="">Select company</option>
                {companyId && !companyOptions.some((c) => c.id === companyId) && (
                  <option value={companyId}>Inherited company</option>
                )}
                {companyOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {companies.hasNextPage && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void companies.fetchNextPage()}
                >
                  Load more companies
                </Button>
              )}
            </div>
            <div>
              <Label htmlFor="doc-machine">Machine</Label>
              <Select
                id="doc-machine"
                value={serialId}
                disabled={locked || !companyId}
                onChange={(event) => setSerialId(event.target.value)}
              >
                <option value="">All company machines in scope</option>
                {serialId && !machineOptions.some((m) => m.id === serialId) && (
                  <option value={serialId}>Inherited machine</option>
                )}
                {machineOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.serialNumber}
                  </option>
                ))}
              </Select>
              {machines.hasNextPage && (
                <Button type="button" variant="ghost" onClick={() => void machines.fetchNextPage()}>
                  Load more machines
                </Button>
              )}
            </div>
          </>
        )}
      </fieldset>
      {(companies.error ?? machines.error ?? installations.error) && (
        <p role="alert" className="text-danger">
          Scope choices could not load.{' '}
          <Button
            variant="ghost"
            onClick={() => {
              void companies.refetch();
              void machines.refetch();
            }}
          >
            Retry
          </Button>
        </p>
      )}
      {preview && (
        <div role="status" className="border-border border-y py-3">
          <p>
            {preview[0]?.total ?? 0} machines match this scope.{' '}
            {tier === 'T3'
              ? 'Internal staff access only.'
              : 'Customer access begins after approval.'}
          </p>
          <ul>
            {preview.map((machine) => (
              <li key={machine.id}>
                {machine.serialNumber} · {machine.companyName}
              </li>
            ))}
          </ul>
          {(preview[0]?.total ?? 0) > 20 && (
            <p>Showing the first 20 machines. The saved document has a paginated preview.</p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" value="preview" formNoValidate variant="secondary" disabled={busy}>
          Preview applicability
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : mode === 'edit' ? 'Save draft' : 'Upload draft'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            if (onSaved) onSaved();
            else setExpanded(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
