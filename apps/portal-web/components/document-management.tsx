'use client';
import { useEffect, useState, type JSX } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DocumentId } from '@argoniq/core-domain';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Input,
  Label,
  Textarea,
  Text,
} from '@argoniq/ui';
import { trpc } from '../lib/trpc/client.js';
import { useWorkspaceAbility } from '../lib/workspace-access.js';
import { DocumentUploader } from './document-uploader.js';

export function DocumentManagement({ documentId }: { documentId: string }): JSX.Element | null {
  const ability = useWorkspaceAbility();
  const canEdit = ability?.can('update', 'Document') ?? false;
  const canPublish = ability?.can('publish', 'Document') ?? false;
  const router = useRouter();
  const id = DocumentId.parse(documentId);
  const query = trpc.document.get.useQuery(
    { documentId: id },
    { enabled: canEdit, refetchInterval: 5000 },
  );
  const doc = query.data?.document;
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState<
    'submit' | 'return_to_draft' | 'publish' | 'withdraw' | 'restore' | 'delete' | null
  >(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [effective, setEffective] = useState('');
  const [offset, setOffset] = useState(0);
  const [scopeOffset, setScopeOffset] = useState(0);
  const transition = trpc.document.transition.useMutation();
  const retry = trpc.document.reprocess.useMutation();
  const review = trpc.document.reviewChunk.useMutation();
  const extraction = trpc.document.extraction.useQuery(
    { documentId: id, updatedAt: doc?.updatedAt ?? new Date(0), offset },
    { enabled: canEdit && !!doc && doc.status !== 'processing' },
  );
  const scope = trpc.document.previewScope.useQuery(
    { documentId: id, offset: scopeOffset },
    { enabled: canEdit },
  );
  const families = trpc.management.listFamilies.useQuery(undefined, {
    enabled: canEdit && editing,
  });
  const utils = trpc.useUtils();
  const [models, setModels] = useState<{ id: string; familyId: string; name: string }[]>([]);
  useEffect(() => {
    if (!families.data || !editing) return;
    let active = true;
    void Promise.all(
      families.data.map((f) => utils.management.listModels.fetch({ familyId: f.id })),
    )
      .then((rows) => {
        if (active) setModels(rows.flat());
      })
      .catch(() => {
        if (active) setError('Could not load models. Close and reopen the editor to retry.');
      });
    return () => {
      active = false;
    };
  }, [families.data, editing, utils]);
  if (!canEdit) return null;
  if (!doc)
    return (
      <Text>
        {query.error
          ? 'Document controls could not load. Refresh to retry.'
          : 'Loading document controls…'}
      </Text>
    );
  const busy = transition.isPending || retry.isPending || review.isPending;
  const refresh = async () => {
    await query.refetch();
    router.refresh();
  };
  const ask = (next: NonNullable<typeof action>) => {
    setAction(next);
    setReason('');
    setError('');
    setEffective('');
  };
  const confirm = async () => {
    if (!action) return;
    try {
      setError('');
      await transition.mutateAsync({
        documentId: id,
        updatedAt: doc.updatedAt,
        action,
        reason,
        ...(effective ? { effectiveFrom: new Date(effective) } : {}),
      });
      if (action === 'delete') {
        router.push('/manage/documents');
        router.refresh();
        return;
      }
      setSuccess('Document saved.');
      setAction(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.');
    }
  };
  const publicationLabel =
    doc.publication === 'approved' && doc.effectiveFrom && new Date(doc.effectiveFrom) > new Date()
      ? 'Scheduled'
      : doc.publication === 'approved' && !doc.isCurrent
        ? 'Superseded'
        : doc.publication.replaceAll('_', ' ');
  return (
    <section
      className="border-border flex flex-col gap-4 border-y py-4"
      aria-label="Document management"
    >
      <div className="flex flex-wrap items-center gap-3">
        <strong className="capitalize">{publicationLabel}</strong>
        <span>
          {!doc.indexable
            ? 'Reference only'
            : doc.status === 'uploaded'
              ? 'Queued for processing'
              : doc.status === 'ingested'
                ? 'Text extracted'
                : doc.status}
        </span>
        <span>{doc.language === 'it' ? 'Italian source' : 'English source'}</span>
      </div>
      {doc.processingError && (
        <p role="alert" className="text-danger">
          {doc.processingError}
        </p>
      )}
      {doc.extractionReport && (
        <Text tone="muted">
          Text found on {doc.extractionReport.textPages} of {doc.extractionReport.pages} pages.{' '}
          {doc.extractionReport.reviewChunks} passages require source comparison before AI use.
          Missing scans, figures and unreviewed passages are excluded from AI evidence.
        </Text>
      )}
      <div className="flex flex-wrap gap-2">
        {doc.publication === 'draft' && !doc.publishedAt && (
          <>
            <Button
              variant="secondary"
              disabled={busy || doc.status === 'processing'}
              onClick={() => setEditing(true)}
            >
              Edit draft
            </Button>
            {doc.indexable && (
              <Button
                variant="secondary"
                disabled={busy || doc.status === 'processing'}
                onClick={() => {
                  setError('');
                  void retry
                    .mutateAsync({ documentId: id })
                    .then(async () => {
                      setSuccess('Processing requested.');
                      await refresh();
                    })
                    .catch((cause: unknown) =>
                      setError(cause instanceof Error ? cause.message : 'Could not save.'),
                    );
                }}
              >
                Retry processing
              </Button>
            )}
            <Button
              disabled={busy || (doc.indexable && doc.status !== 'ingested')}
              onClick={() => ask('submit')}
            >
              Submit for review
            </Button>
            {ability?.can('delete', 'Document') && (
              <Button
                variant="ghost"
                disabled={busy || doc.status === 'processing'}
                onClick={() => ask('delete')}
              >
                Delete draft
              </Button>
            )}
          </>
        )}
        {doc.publication === 'in_review' && (
          <>
            <Button variant="secondary" onClick={() => ask('return_to_draft')}>
              Return to draft
            </Button>
            {canPublish && (
              <Button disabled={scope.isPending || !!scope.error} onClick={() => ask('publish')}>
                Publish revision
              </Button>
            )}
          </>
        )}
        {doc.publication === 'approved' && canPublish && (
          <Button variant="secondary" onClick={() => ask('withdraw')}>
            Withdraw revision
          </Button>
        )}
        {doc.publication === 'withdrawn' && canPublish && (
          <Button variant="secondary" onClick={() => ask('restore')}>
            Restore revision
          </Button>
        )}
        <Button asChild variant="secondary">
          <Link href={`/manage/documents/upload?previous=${doc.id}`}>Upload new revision</Link>
        </Button>
      </div>
      {success && <p role="status">{success}</p>}
      {error && !action && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <details>
        <summary className="min-h-11 cursor-pointer py-3 font-medium">
          Preview affected machines ({scope.data?.[0]?.total ?? 0})
        </summary>
        {scope.error ? (
          <p role="alert">
            Could not load applicability.{' '}
            <Button variant="ghost" onClick={() => void scope.refetch()}>
              Retry
            </Button>
          </p>
        ) : (
          <>
            <p className="text-text-muted">
              {doc.tier === 'T3'
                ? 'Internal service team only; customers cannot read this source.'
                : 'After approval, the following companies can read this revision on applicable machines.'}
            </p>
            <ul className="my-2">
              {scope.data?.map((machine) => (
                <li key={machine.id}>
                  <Link className="text-accent" href={`/machines/${machine.id}`}>
                    {machine.serialNumber}
                  </Link>{' '}
                  · {machine.companyName}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={!scopeOffset}
                onClick={() => setScopeOffset(scopeOffset - 20)}
              >
                Previous machines
              </Button>
              <Button
                variant="ghost"
                disabled={scopeOffset + 20 >= (scope.data?.[0]?.total ?? 0)}
                onClick={() => setScopeOffset(scopeOffset + 20)}
              >
                More machines
              </Button>
            </div>
          </>
        )}
      </details>
      {doc.indexable && (
        <details>
          <summary className="min-h-11 cursor-pointer py-3 font-medium">
            Review extracted text
          </summary>
          <Text tone="muted">
            Compare pages, tables and units against the source PDF. Only reviewed, approved content
            can support answers.
          </Text>
          {extraction.error && (
            <p role="alert">
              Extraction could not load.{' '}
              <Button variant="ghost" onClick={() => void extraction.refetch()}>
                Retry
              </Button>
            </p>
          )}
          {extraction.data?.items.map((chunk) => (
            <article key={chunk.id} className="border-border border-b py-3">
              <p>
                Page {chunk.page ?? 'unknown'} · {chunk.type} ·{' '}
                {chunk.aiMayCite ? 'Eligible after publication' : 'Excluded from AI'}
              </p>
              <pre className="my-2 max-h-72 overflow-y-auto font-sans text-sm break-words whitespace-pre-wrap">
                {chunk.content}
              </pre>
              {canPublish && doc.publication === 'in_review' && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    void review
                      .mutateAsync({
                        documentId: id,
                        updatedAt: doc.updatedAt,
                        chunkId: chunk.id,
                        aiMayCite: !chunk.aiMayCite,
                        reason: chunk.aiMayCite
                          ? 'Reviewer excluded passage after source comparison.'
                          : 'Reviewer verified passage against the original PDF.',
                      })
                      .then(refresh)
                      .catch((cause: unknown) =>
                        setError(cause instanceof Error ? cause.message : 'Could not save.'),
                      );
                  }}
                >
                  {chunk.aiMayCite ? 'Exclude passage' : 'Verified against source — allow passage'}
                </Button>
              )}
            </article>
          ))}
          <div className="flex gap-2">
            <Button variant="ghost" disabled={!offset} onClick={() => setOffset(offset - 10)}>
              Previous passages
            </Button>
            <Button
              variant="ghost"
              disabled={!extraction.data?.hasMore}
              onClick={() => setOffset(offset + 10)}
            >
              More passages
            </Button>
          </div>
        </details>
      )}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit document draft</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {families.data ? (
              <DocumentUploader
                families={families.data}
                models={models}
                initiallyExpanded
                mode="edit"
                initial={doc}
                onSaved={() => {
                  setEditing(false);
                  void refresh();
                }}
              />
            ) : (
              <p>Loading scope choices…</p>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !busy) setAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'delete'
                ? 'Delete unpublished draft?'
                : `${action?.replaceAll('_', ' ')} revision ${doc.revisionLabel ?? ''}`}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text>
              {action === 'delete'
                ? 'The source and extraction will be removed from the library. Published revisions remain protected.'
                : 'Confirm the source review and affected machines. This decision is recorded with your identity.'}
            </Text>
            {(action === 'publish' || action === 'restore') && (
              <div className="mt-3">
                <Label htmlFor="doc-effective">Effective from (leave blank for now)</Label>
                <Input
                  id="doc-effective"
                  type="datetime-local"
                  value={effective}
                  onChange={(event) => setEffective(event.target.value)}
                />
              </div>
            )}
            <div className="mt-3">
              <Label htmlFor="doc-reason">Reason / review notes</Label>
              <Textarea
                id="doc-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                minLength={3}
                maxLength={1000}
              />
            </div>
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" disabled={busy} onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button disabled={busy || reason.trim().length < 3} onClick={() => void confirm()}>
              {busy ? 'Saving…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
