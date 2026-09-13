'use client';

import { useEffect, useRef, useState, type JSX, type FormEvent } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import {
  CaseCreateInput,
  ChatSupportDraft,
  type SupportReport,
  SUPPORT_IMPACT_LABEL,
  CASE_FILE_ACCEPT,
  MAX_CASE_FILE_BYTES,
  MAX_CASE_FILES,
  MAX_CASE_TOTAL_BYTES,
} from '@argoniq/core-domain';
import { Button, Combobox, ErrorState, Input, Textarea, Select } from '@argoniq/ui';
import { trpc } from '../lib/trpc/client.js';
import { caseDraftKey } from '../lib/case-draft-storage.js';
import { routes } from '../lib/routes.js';

type Upload = { file: File; error: string; progress: number; uploading: boolean };
const blankReport: SupportReport = {
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  contactPreference: 'email',
  impact: 'unknown',
  safetyConcern: 'unknown',
  alarmCode: '',
  startedAt: '',
  observations: '',
};
export function CaseCreate({
  serialId: initialSerialId,
  storageScope,
  contact,
  draftId,
}: {
  serialId?: string | undefined;
  storageScope: string;
  draftId?: string | undefined;
  contact?: { name: string; email: string } | undefined;
}): JSX.Element {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [serialId, setSerialId] = useState(initialSerialId ?? '');
  const [summary, setSummary] = useState('');
  const [report, setReport] = useState<SupportReport>({
    ...blankReport,
    contactName: contact?.name ?? '',
    contactEmail: contact?.email ?? '',
  });
  const [submissionKey, setSubmissionKey] = useState('');
  const [preparation, setPreparation] = useState<'assisted' | 'verbatim' | null>(null);
  const [ready, setReady] = useState(false);
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const busy = useRef(false);
  const key = caseDraftKey(storageScope, initialSerialId, draftId);
  useEffect(() => {
    let requestKey: string = crypto.randomUUID();
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? '{}') as Record<string, unknown>;
      if (draftId && !saved.submissionKey)
        setError(
          'This chat draft is unavailable in this account or browser tab. Return to the conversation and prepare it again.',
        );
      if (saved.preparation === 'assisted' || saved.preparation === 'verbatim')
        setPreparation(saved.preparation);
      if (typeof saved.summary === 'string') setSummary(saved.summary);
      if (!initialSerialId && typeof saved.serialId === 'string') setSerialId(saved.serialId);
      if (typeof saved.submissionKey === 'string' && /^[0-9a-f-]{36}$/i.test(saved.submissionKey))
        requestKey = saved.submissionKey;
      if (saved.report && typeof saved.report === 'object') {
        const draft = saved.report as Record<string, unknown>;
        setReport((previous) => {
          const next = { ...previous };
          const sources = ChatSupportDraft.shape.sources.safeParse(draft.sourceReferences ?? []);
          if (sources.success) next.sourceReferences = sources.data;
          next.preparedFromChat = draft.preparedFromChat === true;
          for (const field of [
            'contactName',
            'contactEmail',
            'contactPhone',
            'alarmCode',
            'startedAt',
            'observations',
          ] as const)
            if (typeof draft[field] === 'string') next[field] = draft[field];
          if (['email', 'phone'].includes(String(draft.contactPreference)))
            next.contactPreference = draft.contactPreference as SupportReport['contactPreference'];
          if (Object.hasOwn(SUPPORT_IMPACT_LABEL, String(draft.impact)))
            next.impact = draft.impact as SupportReport['impact'];
          if (['yes', 'no', 'unknown'].includes(String(draft.safetyConcern)))
            next.safetyConcern = draft.safetyConcern as SupportReport['safetyConcern'];
          return next;
        });
      }
    } catch {
      /* Optional local draft recovery. */
    }
    setSubmissionKey(requestKey);
    setReady(true);
  }, [key, initialSerialId, draftId]);
  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ serialId, summary, report, submissionKey, preparation }),
      );
    } catch {
      /* Intake remains usable without browser storage. */
    }
  }, [key, ready, serialId, summary, report, submissionKey, preparation]);
  useEffect(() => {
    if (review) heading.current?.focus();
  }, [review]);
  const machines = trpc.machine.listSerials.useInfiniteQuery(
    { limit: 100 },
    { getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined },
  );
  const selected = trpc.machine.getSerialDetail.useQuery(
    { serialId },
    { enabled: Boolean(serialId) },
  );
  const selectedMachine = selected.data?.serial;
  const destination = trpc.case.destination.useQuery({ serialId }, { enabled: Boolean(serialId) });
  const attachments = trpc.case.draftAttachments.useQuery(
    { serialId, submissionKey },
    { enabled: Boolean(serialId && submissionKey) },
  );
  const files = attachments.data ?? [];
  const options = (machines.data?.pages.flatMap((page) => page.items) ?? []).map((m) => ({
    value: m.id,
    label: m.serialNumber,
    description: m.customerTag ?? undefined,
  }));
  if (selectedMachine && !options.some((m) => m.value === selectedMachine.id))
    options.unshift({
      value: selectedMachine.id,
      label: selectedMachine.serialNumber,
      description: selectedMachine.customerTag ?? undefined,
    });
  const create = trpc.case.create.useMutation({
    onSuccess: (record) => {
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* Optional storage. */
      }
      void utils.case.list.invalidate();
      router.replace(`${routes.cases}/${record.id}`);
    },
    onError: (failure) => setError(failure.message),
  });
  const remove = trpc.case.removeDraftAttachment.useMutation({
    onSuccess: () => {
      void attachments.refetch();
    },
    onError: (failure) => setError(failure.message),
  });
  const pending = uploads.some((u) => u.uploading);
  const update = <K extends keyof SupportReport>(field: K, value: SupportReport[K]) =>
    setReport((prev) => ({ ...prev, [field]: value }));
  async function upload(file: File) {
    if (busy.current) return;
    busy.current = true;
    setUploads((prev) => [
      ...prev.filter((u) => u.file !== file),
      { file, error: '', progress: 0, uploading: true },
    ]);
    const state = (patch: Partial<Upload>) =>
      setUploads((prev) => prev.map((u) => (u.file === file ? { ...u, ...patch } : u)));
    try {
      if (file.size > MAX_CASE_FILE_BYTES)
        throw new Error('This file exceeds 10 MB. Choose a smaller file.');
      if (
        files.length >= MAX_CASE_FILES ||
        files.reduce((n, f) => n + f.size, 0) + file.size > MAX_CASE_TOTAL_BYTES
      )
        throw new Error('Use up to 5 files, 20 MB in total.');
      const form = new FormData();
      form.set('file', file);
      form.set('serialId', serialId);
      form.set('submissionKey', submissionKey);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/cases/attachments');
        xhr.timeout = 120_000;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) state({ progress: Math.round((e.loaded / e.total) * 100) });
        };
        xhr.onerror = () =>
          reject(new Error('Connection interrupted. Check the uploaded files before retrying.'));
        xhr.ontimeout = () =>
          reject(new Error('Upload timed out. Check the uploaded files before retrying.'));
        xhr.onload = () => {
          let body: { error?: string } = {};
          try {
            body = JSON.parse(xhr.responseText) as { error?: string };
          } catch {
            /* Fall back to an actionable error. */
          }
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(body.error ?? 'Upload failed. Try again.'));
        };
        xhr.send(form);
      });
      setUploads((prev) => prev.filter((u) => u.file !== file));
    } catch (failure) {
      state({
        error: failure instanceof Error ? failure.message : 'Upload failed.',
        uploading: false,
      });
    } finally {
      await attachments.refetch();
      busy.current = false;
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || busy.current || remove.isPending) return;
    const input = CaseCreateInput.safeParse({
      serialId,
      summary,
      report,
      submissionKey,
      attachmentIds: files.map((f) => f.id),
      destinationVersion: destination.data?.version,
      confirmed: true,
    });
    if (!input.success) {
      setError(input.error.issues[0]?.message ?? 'Review the required fields.');
      return;
    }
    setError('');
    if (!review) {
      setReview(true);
      return;
    }
    create.mutate(input.data);
  }
  const destinationText = destination.data
    ? `${destination.data.label} · ${destination.data.channel === 'inbox' ? 'Support inbox' : destination.data.channel === 'email' ? 'Email' : 'ServiceMax'}`
    : 'Select a machine to see the support team.';
  return (
    <form onSubmit={submit} className="max-w-5xl">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)]">
        <div className="min-w-0 space-y-6">
          {preparation ? (
            <p role="status" className="border-border bg-canvas rounded-md border p-3 text-sm">
              {preparation === 'assisted'
                ? 'Prepared from your conversation. Check the details, add any files, then review and send. Unknown details have been left blank.'
                : 'Automatic field preparation was unavailable. Your own messages have been copied into the description; check them and complete any details you want to share.'}{' '}
              Nothing has been submitted.
            </p>
          ) : null}
          {review ? (
            <section aria-labelledby="request-review" className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="request-review"
                  ref={heading}
                  tabIndex={-1}
                  className="text-lg font-semibold"
                >
                  Review your request
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={create.isPending}
                  onClick={() => setReview(false)}
                >
                  Edit details
                </Button>
              </div>
              <p className="text-text-muted text-sm">
                This report and the files below will be sent to {destination.data?.label}. Your
                company and manufacturer can access the saved request. Send it even if some details
                are unknown.
              </p>
              <div>
                <h3 className="mb-2 text-sm font-medium">What happened</h3>
                <p className="text-base break-words whitespace-pre-wrap">{summary}</p>
              </div>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <ReviewItem label="Machine" value={selectedMachine?.serialNumber ?? serialId} />
                <ReviewItem label="Reported impact" value={SUPPORT_IMPACT_LABEL[report.impact]} />
                <ReviewItem
                  label="Safety concern"
                  value={
                    report.safetyConcern === 'yes'
                      ? 'Reported'
                      : report.safetyConcern === 'no'
                        ? 'None reported'
                        : 'Not sure'
                  }
                />
                <ReviewItem label="Alarm code" value={report.alarmCode || 'Not known'} />
                <ReviewItem label="When it started" value={report.startedAt || 'Not known'} />
                <ReviewItem
                  label="Contact"
                  value={`${report.contactName} · ${report.contactEmail}${report.contactPhone ? ` · ${report.contactPhone}` : ''}`}
                />
                <ReviewItem
                  label="Preferred reply"
                  value={report.contactPreference === 'phone' ? 'Phone' : 'Email'}
                />
              </dl>
              {report.observations ? (
                <div>
                  <h3 className="text-sm font-medium">Changes and observations</h3>
                  <p className="mt-2 text-sm break-words whitespace-pre-wrap">
                    {report.observations}
                  </p>
                </div>
              ) : null}
            </section>
          ) : (
            <>
              <section aria-label="Machine and problem" className="space-y-5">
                <div>
                  <label htmlFor="case-machine" className="mb-1.5 block text-sm font-medium">
                    Machine <span className="text-text-muted">(required)</span>
                  </label>
                  <Combobox
                    id="case-machine"
                    value={serialId}
                    options={options}
                    loading={machines.isLoading}
                    disabled={pending || files.length > 0}
                    placeholder="Select a machine…"
                    searchPlaceholder="Search loaded machines…"
                    onChange={(value) => {
                      setSerialId(value);
                      setUploads([]);
                    }}
                  />
                  {selected.data ? (
                    <p className="text-text-muted mt-2 text-sm">
                      {selected.data.modelName} · {selected.data.companyName}
                      {selectedMachine?.customerTag ? ` · ${selectedMachine.customerTag}` : ''}
                    </p>
                  ) : null}
                  {files.length ? (
                    <p className="text-text-muted mt-1.5 text-xs">
                      Remove the attachments before changing the machine.
                    </p>
                  ) : null}
                  {machines.hasNextPage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={machines.isFetchingNextPage}
                      onClick={() => void machines.fetchNextPage()}
                    >
                      Load more machines
                    </Button>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="case-summary" className="mb-1.5 block text-sm font-medium">
                    What happened? <span className="text-text-muted">(required)</span>
                  </label>
                  <Textarea
                    id="case-summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    required
                    minLength={10}
                    maxLength={4000}
                    rows={5}
                    placeholder="Tell us what the machine is doing and what you need help with."
                    aria-describedby="case-summary-help"
                  />
                  <p id="case-summary-help" className="text-text-muted mt-1.5 text-xs">
                    Use your own words. You can send a request without diagnosing the problem.
                  </p>
                </div>
                <div>
                  <label htmlFor="case-impact" className="mb-1.5 block text-sm font-medium">
                    How is the machine affected?
                  </label>
                  <Select
                    id="case-impact"
                    value={report.impact}
                    onChange={(e) => update('impact', e.target.value as SupportReport['impact'])}
                  >
                    {Object.entries(SUPPORT_IMPACT_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
              </section>
              <details className="group" open={preparation ? true : undefined}>
                <summary className="focus-visible:outline-focus cursor-pointer py-2 text-sm font-medium">
                  Add alarm, timing or safety details{' '}
                  <span className="text-text-muted font-normal">(optional)</span>
                </summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Alarm or error code" id="case-alarm">
                    <Input
                      id="case-alarm"
                      value={report.alarmCode}
                      maxLength={200}
                      onChange={(e) => update('alarmCode', e.target.value)}
                    />
                  </Field>
                  <Field label="When did it start?" id="case-started">
                    <Input
                      id="case-started"
                      value={report.startedAt}
                      maxLength={200}
                      placeholder="For example, this morning"
                      onChange={(e) => update('startedAt', e.target.value)}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Is there a safety concern?" id="case-safety">
                      <Select
                        id="case-safety"
                        value={report.safetyConcern}
                        onChange={(e) =>
                          update('safetyConcern', e.target.value as SupportReport['safetyConcern'])
                        }
                      >
                        <option value="unknown">Not sure</option>
                        <option value="yes">Yes, I am concerned</option>
                        <option value="no">No concern observed</option>
                      </Select>
                    </Field>
                    {report.safetyConcern === 'yes' ? (
                      <p role="status" className="text-text-muted mt-2 text-sm">
                        You can send this report now. Follow your site’s emergency procedure for
                        immediate danger; this form is not an emergency channel.
                      </p>
                    ) : null}
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Recent changes or observations" id="case-observations">
                      <Textarea
                        id="case-observations"
                        value={report.observations}
                        maxLength={2000}
                        onChange={(e) => update('observations', e.target.value)}
                        placeholder="Anything that changed, or checks you have already completed safely."
                      />
                    </Field>
                  </div>
                </div>
              </details>
              <section aria-labelledby="request-contact" className="space-y-4">
                <h2 id="request-contact" className="text-base font-semibold">
                  How can support reach you?
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name (required)" id="case-name">
                    <Input
                      id="case-name"
                      autoComplete="name"
                      required
                      maxLength={120}
                      value={report.contactName}
                      onChange={(e) => update('contactName', e.target.value)}
                    />
                  </Field>
                  <Field label="Email (required)" id="case-email">
                    <Input
                      id="case-email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      value={report.contactEmail}
                      onChange={(e) => update('contactEmail', e.target.value)}
                    />
                  </Field>
                  <Field label="Preferred reply" id="case-preference">
                    <Select
                      id="case-preference"
                      value={report.contactPreference}
                      onChange={(e) =>
                        update(
                          'contactPreference',
                          e.target.value as SupportReport['contactPreference'],
                        )
                      }
                    >
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                    </Select>
                  </Field>
                  <Field
                    label={
                      report.contactPreference === 'phone' ? 'Phone (required)' : 'Phone (optional)'
                    }
                    id="case-phone"
                  >
                    <Input
                      id="case-phone"
                      type="tel"
                      autoComplete="tel"
                      required={report.contactPreference === 'phone'}
                      maxLength={60}
                      value={report.contactPhone}
                      onChange={(e) => update('contactPhone', e.target.value)}
                    />
                  </Field>
                </div>
              </section>
            </>
          )}
          {report.sourceReferences?.length ? (
            <section aria-label="Sources from the conversation">
              <h2 className="mb-2 text-base font-semibold">Sources from the conversation</h2>
              <p className="text-text-muted mb-2 text-xs">
                Reference material consulted in chat; these links do not confirm a cause.
              </p>
              <ul className="space-y-2">
                {report.sourceReferences.map((source) => (
                  <li
                    key={`${source.documentId}:${source.page ?? ''}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <a
                      className="text-accent text-sm hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`${routes.technicalDocument(source.documentId)}${source.page ? `?page=${source.page}` : ''}`}
                    >
                      {source.title}
                      {source.page ? ` · Page ${source.page}` : ''}
                    </a>
                    {!review ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setReport((r) => ({
                            ...r,
                            sourceReferences: r.sourceReferences?.filter((s) => s !== source),
                          }))
                        }
                      >
                        Remove source
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section aria-labelledby="request-files" className="space-y-3">
            <h2 id="request-files" className="text-base font-semibold">
              Photos and attachments{' '}
              <span className="text-text-muted text-sm font-normal">(optional)</span>
            </h2>
            {!review ? (
              <>
                <p id="case-files-help" className="text-text-muted text-sm">
                  Share a photo of the issue, an alarm screenshot, a short video or a log. Up to 5
                  files, 10 MB each and 20 MB total. JPG, PNG, WebP, PDF, MP4, TXT, CSV or LOG.
                </p>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Choose a file</span>
                  <input
                    aria-describedby="case-files-help"
                    type="file"
                    accept={CASE_FILE_ACCEPT}
                    disabled={
                      !serialId ||
                      !ready ||
                      pending ||
                      files.length >= MAX_CASE_FILES ||
                      attachments.isPending
                    }
                    className="border-border focus-visible:outline-focus block min-h-11 w-full rounded-md border p-2 text-sm file:mr-3 file:cursor-pointer file:font-medium"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void upload(file);
                      e.target.value = '';
                    }}
                  />
                </label>
                {!serialId ? (
                  <p className="text-text-muted text-xs">Select a machine first.</p>
                ) : null}
              </>
            ) : null}
            {files.length ? (
              <ul className="divide-border divide-y">
                {files.map((file) => (
                  <li
                    key={file.id}
                    className="flex min-w-0 items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <a
                        href={`/api/cases/attachments/${file.id}`}
                        className="text-accent text-sm break-all hover:underline"
                      >
                        {file.filename}
                      </a>
                      <p className="text-text-muted text-xs">
                        {(file.size / 1024 / 1024).toFixed(1)} MB · Attached
                      </p>
                    </div>
                    {!review ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${file.filename}`}
                        disabled={remove.isPending || pending}
                        onClick={() => remove.mutate({ attachmentId: file.id })}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : review ? (
              <p className="text-text-muted text-sm">No attachments.</p>
            ) : null}
            <div aria-live="polite">
              {uploads.map((u, index) => (
                <div key={index} className="mt-3 space-y-2 text-sm">
                  <p className="break-all">
                    {u.file.name} · {u.uploading ? `Uploading ${u.progress}%` : 'Not attached'}
                  </p>
                  {u.uploading ? (
                    <progress
                      aria-label={`Uploading ${u.file.name}`}
                      max={100}
                      value={u.progress}
                      className="w-full"
                    />
                  ) : (
                    <>
                      <p role="alert" className="text-danger">
                        {u.error}
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={pending}
                        onClick={() => void upload(u.file)}
                      >
                        Retry upload
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setUploads((prev) => prev.filter((item) => item !== u))}
                      >
                        Dismiss
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
            {!review ? (
              <p className="text-text-muted text-xs">
                Attachments are shared only when you submit. Unsubmitted files expire after 24
                hours. Files are evidence for support; they are not analyzed by AI.
              </p>
            ) : null}
          </section>
          {error || machines.error || destination.error || attachments.error ? (
            <ErrorState
              title="Check your request"
              description={
                error ||
                (machines.error?.message ??
                  destination.error?.message ??
                  attachments.error?.message ??
                  '')
              }
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-3 pb-6">
            <Button
              type="submit"
              disabled={
                !ready ||
                !serialId ||
                !destination.data ||
                destination.isError ||
                attachments.isPending ||
                attachments.isError ||
                create.isPending ||
                pending ||
                remove.isPending
              }
              className="w-full sm:w-auto"
            >
              {create.isPending
                ? 'Sending request…'
                : review
                  ? 'Send support request'
                  : 'Review request'}
            </Button>
            {!review ? (
              <span className="text-text-muted text-xs">Optional details can be left unknown.</span>
            ) : null}
          </div>
        </div>
        <aside
          className="border-border bg-surface rounded-md border p-4 text-sm lg:sticky lg:top-6"
          aria-label="Support destination"
        >
          <h2 className="font-semibold">Who receives this?</h2>
          <p className="mt-2 break-words">{destinationText}</p>
          <p className="text-text-muted mt-3">
            {destination.data?.channel === 'email'
              ? 'Your report and files are sent by email. Support can reply directly to the contact email you provide.'
              : destination.data?.channel === 'servicemax'
                ? 'Your report and files are handed to the configured ServiceMax team. They will follow up using your contact details.'
                : 'Your manufacturer’s team can read this request in its support inbox.'}
          </p>
          <p className="text-text-muted mt-3">
            After sending, you’ll get a request reference and a delivery status. A response time has
            not been confirmed.
          </p>
        </aside>
      </div>
    </form>
  );
}
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-text-muted text-xs">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}
