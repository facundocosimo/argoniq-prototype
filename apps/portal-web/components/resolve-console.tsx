'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import { saveChatSupportDraft } from '../lib/case-draft-storage.js';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Boxes,
  ChevronRight,
  CircleHelp,
  FileText,
  Gauge,
  MessageSquare,
  PanelRight,
  Wrench,
} from 'lucide-react';
import {
  AiDisclosure,
  AnswerView,
  Button,
  CauseRankingList,
  EmptyState,
  ErrorState,
  Inline,
  LogoMark,
  Markdown,
  Spinner,
  SymptomComposer,
  Text,
  cn,
  type CitationView,
} from '@argoniq/ui';
import { trpc } from '../lib/trpc/client.js';
import { routes } from '../lib/routes.js';
import { useWorkspaceAbility, useWorkspaceScope } from '../lib/workspace-access.js';

type AnswerData = NonNullable<ReturnType<typeof trpc.intelligence.answer.useMutation>['data']>;
export type ResolveMachine = {
  readonly serialNumber: string;
  readonly modelName: string;
  readonly familyName: string;
};
type Turn =
  | { readonly role: 'user'; readonly text: string }
  | { readonly role: 'assistant'; readonly data: AnswerData };

const STARTERS = [
  {
    icon: CircleHelp,
    label: 'Understand an alarm',
    description: 'Find what a code means.',
    prompt: 'What exact alarm code or message is displayed?',
  },
  {
    icon: Gauge,
    label: 'Find a specification',
    description: 'Look up a value in the manual.',
    prompt: 'Which specification or setting would you like to look up?',
  },
  {
    icon: Wrench,
    label: 'Describe a problem',
    description: 'Share what you have observed.',
    prompt: 'What is the machine doing, or failing to do?',
  },
] as const;

/** Keep page-level sources distinct; links open a separate tab so the conversation survives. */
function toCitations(citations: AnswerData['citations']): CitationView[] {
  const seen = new Set<string>();
  return citations.flatMap((citation) => {
    if (!citation.documentId) return [];
    const key = `${citation.documentId}#${citation.sectionPath ?? ''}#${citation.page ?? ''}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      {
        id: key,
        label: `${citation.title ?? 'Technical document'}${citation.sectionTitle ? ` · ${citation.sectionTitle}` : ''}`,
        ...(citation.page ? { ref: `Page ${citation.page}` } : {}),
        href: `${routes.technicalDocument(citation.documentId)}${citation.page ? `?page=${citation.page}` : ''}`,
      },
    ];
  });
}

/** Feature composition only: the existing service owns machine scope, safety and model calls. */
export function ResolveConsole({
  serialId,
  machine,
}: {
  serialId?: string;
  machine?: ResolveMachine;
}): JSX.Element {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [lastUserText, setLastUserText] = useState('');
  const [seed, setSeed] = useState('');
  const [seedKey, setSeedKey] = useState(0);
  const [starterPrompt, setStarterPrompt] = useState('');
  const [focusRequest, setFocusRequest] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'conversation' | 'context'>('conversation');
  const threadRef = useRef<HTMLDivElement>(null);
  const lastQuestionRef = useRef<HTMLDivElement>(null);
  const sourcesHeadingRef = useRef<HTMLHeadingElement>(null);
  const contextTriggerRef = useRef<HTMLButtonElement>(null);
  const hasSwitchedPanel = useRef(false);
  const submittingRef = useRef(false);
  const ability = useWorkspaceAbility();
  const scope = useWorkspaceScope();
  const router = useRouter();
  const handoffKey = useRef<string>('');
  const [handoffError, setHandoffError] = useState('');
  const handoff = trpc.case.prepareDraft.useMutation({
    onSuccess: (draft) => {
      try {
        saveChatSupportDraft(sessionStorage, scope, handoffKey.current, draft);
        router.push(`${routes.cases}/new?serialId=${draft.serialId}&draft=${handoffKey.current}`);
      } catch {
        setHandoffError(
          'The draft could not be saved in this browser. Your conversation is still here. Enable browser storage and try again.',
        );
      }
    },
  });
  const answer = trpc.intelligence.answer.useMutation({
    onSuccess: (data) => {
      setTurns((current) => [...current, { role: 'assistant', data }]);
      setSelectedIndex(null);
    },
    onSettled: () => {
      submittingRef.current = false;
    },
  });
  const lastUserIndex = turns.map((turn) => turn.role).lastIndexOf('user');
  const latestAnswerIndex = turns.map((turn) => turn.role).lastIndexOf('assistant');
  const activeIndex = selectedIndex ?? latestAnswerIndex;
  const activeTurn = turns[activeIndex];
  const activeAnswer = activeTurn?.role === 'assistant' ? activeTurn.data : undefined;
  const activeQuestion = turns.slice(0, activeIndex).findLast((turn) => turn.role === 'user');
  const citations = activeAnswer ? toCitations(activeAnswer.citations) : [];

  useEffect(() => {
    if (!hasSwitchedPanel.current) return;
    // Wait for React to reveal the destination pane before transferring focus.
    if (mobilePanel === 'context') sourcesHeadingRef.current?.focus();
    else contextTriggerRef.current?.focus();
  }, [mobilePanel]);

  useEffect(() => {
    const thread = threadRef.current;
    const question = lastQuestionRef.current;
    if (!thread || !question) return;
    // Scroll this pane only; never move the shell, source pane or keyboard focus.
    thread.scrollTo({
      top:
        question.getBoundingClientRect().top -
        thread.getBoundingClientRect().top +
        thread.scrollTop -
        24,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }, [lastUserIndex, turns.length]);

  if (!serialId)
    return (
      <div className="flex h-full items-center justify-center px-4 py-10">
        <EmptyState
          icon={<Boxes className="size-6" aria-hidden />}
          title="Choose a machine to start"
          description="Open a machine, then choose Ask a question."
          action={
            <Button asChild>
              <Link href={routes.machines}>Browse machines</Link>
            </Button>
          }
        />
      </div>
    );
  const resolvedSerial = serialId;
  const hasThread = turns.length > 0;

  function ask(text: string, symptomId?: string): void {
    if (submittingRef.current || handoff.isPending) return;
    handoffKey.current = '';
    submittingRef.current = true;
    const history = turns.map((turn) => ({
      role: turn.role,
      text: turn.role === 'user' ? turn.text : turn.data.customerMessage,
    }));
    if (!symptomId) {
      setStarterPrompt('');
      setLastUserText(text);
      setTurns((current) => [...current, { role: 'user', text }]);
    }
    answer.mutate({
      serialId: resolvedSerial,
      symptomText: text,
      history,
      ...(symptomId ? { symptomId } : {}),
    });
  }
  function contactSupport(): void {
    if (handoff.isPending || answer.isPending) return;
    if (!turns.some((t) => t.role === 'user')) {
      router.push(`${routes.cases}/new?serialId=${resolvedSerial}`);
      return;
    }
    handoffKey.current ||= crypto.randomUUID();
    setHandoffError('');
    handoff.mutate({
      serialId: resolvedSerial,
      history: turns.map((t) => ({
        role: t.role,
        text: t.role === 'user' ? t.text : t.data.customerMessage,
      })),
      sources: turns
        .flatMap((t) =>
          t.role === 'assistant'
            ? t.data.citations.flatMap((c) =>
                c.documentId
                  ? [{ documentId: c.documentId, ...(c.page ? { page: c.page } : {}) }]
                  : [],
              )
            : [],
        )
        .filter(
          (source, index, all) =>
            all.findIndex((s) => s.documentId === source.documentId && s.page === source.page) ===
            index,
        )
        .slice(0, 16),
    });
  }
  function loadStarter(text: string): void {
    setSeed(text);
    setSeedKey((key) => key + 1);
    setMobilePanel('conversation');
  }
  function showSources(index?: number): void {
    if (index !== undefined) setSelectedIndex(index);
    hasSwitchedPanel.current = true;
    setMobilePanel('context');
    if (mobilePanel === 'context') sourcesHeadingRef.current?.focus();
  }

  return (
    <div className="bg-bg grid h-full min-h-0 w-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,28%)]">
      <section
        aria-label="Conversation"
        className={cn(
          'min-h-0 min-w-0 flex-col',
          mobilePanel === 'conversation' ? 'flex' : 'hidden lg:flex',
        )}
      >
        <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <LogoMark size={20} glow={false} />
            <span className="text-sm font-semibold">Technical assistant</span>
          </div>
          <Button
            ref={contextTriggerRef}
            variant="ghost"
            size="sm"
            onClick={() => showSources()}
            className="lg:hidden"
            aria-controls="answer-context"
          >
            <PanelRight className="size-4" aria-hidden /> Sources & context
          </Button>
          <span className="text-text-subtle hidden text-xs lg:block">
            Conversation · this visit
          </span>
        </div>
        <div
          ref={threadRef}
          role="region"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 lg:px-8"
          // Keyboard users need to focus and scroll this independently scrolling pane.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          aria-label="Conversation messages"
        >
          {!hasThread ? (
            <div className="flex min-h-full flex-col justify-center py-8 sm:py-12">
              <div className="mb-8 max-w-prose">
                <h2 className="text-text text-xl font-semibold tracking-tight sm:text-2xl">
                  What would you like to know?
                </h2>
                <p className="text-text-muted mt-3 text-base leading-relaxed">
                  Ask about your machine, find a detail in the manual, or tell us what’s happening.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {STARTERS.map(({ icon: Icon, label, description, prompt }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setStarterPrompt(prompt);
                      setFocusRequest((value) => value + 1);
                    }}
                    className="group border-border bg-surface hover:border-border-strong hover:bg-surface focus-visible:outline-focus flex min-w-0 items-start gap-3 rounded-md border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:flex-col"
                  >
                    <Icon className="text-accent mt-0.5 size-5 shrink-0" aria-hidden />
                    <span className="flex-1">
                      <span className="text-text block text-sm font-medium">{label}</span>
                      <span className="text-text-muted mt-1 block text-sm leading-relaxed">
                        {description}
                      </span>
                    </span>
                    <ChevronRight
                      className="text-text-subtle size-4 shrink-0 self-end sm:hidden"
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
              <p className="text-text-muted mt-5 text-xs">
                Start with the exact alarm or what changed. You can write in your own language.
              </p>
            </div>
          ) : (
            <div className="space-y-8 py-6">
              {turns.map((turn, index) =>
                turn.role === 'user' ? (
                  <div
                    key={index}
                    ref={index === lastUserIndex ? lastQuestionRef : undefined}
                    className="flex justify-end"
                  >
                    <div className="bg-surface max-w-[90%] rounded-lg px-4 py-3 sm:max-w-[80%]">
                      <span className="text-text-muted mb-1 block text-xs font-medium">You</span>
                      <p className="text-base leading-relaxed break-words whitespace-pre-wrap">
                        {turn.text}
                      </p>
                    </div>
                  </div>
                ) : (
                  <AssistantTurn
                    key={index}
                    data={turn.data}
                    onContactSupport={contactSupport}
                    preparingDraft={handoff.isPending}
                    canContactSupport={ability?.can('create', 'Case') ?? false}
                    selected={activeIndex === index}
                    isLast={index === turns.length - 1}
                    onSources={() => showSources(index)}
                    onClarify={(symptomId) => ask(lastUserText, symptomId)}
                    disabled={answer.isPending || handoff.isPending}
                  />
                ),
              )}
              {answer.isPending ? (
                <div role="status" className="text-text-muted flex items-center gap-3 py-3 text-sm">
                  <Spinner className="size-4" />
                  <span>Looking through the available information…</span>
                </div>
              ) : null}
              {answer.error ? (
                <ErrorState
                  className="py-5"
                  title="The answer couldn’t be completed"
                  description={answer.error.message}
                  {...(answer.error.data?.correlationId
                    ? { correlationId: answer.error.data.correlationId }
                    : {})}
                  action={
                    <Button variant="secondary" size="sm" onClick={() => loadStarter(lastUserText)}>
                      Edit question
                    </Button>
                  }
                />
              ) : null}
            </div>
          )}
        </div>
        <div className="shrink-0 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
          {handoff.isPending ? (
            <p role="status" className="text-text-muted mb-3 text-sm">
              Preparing your report from this conversation… Nothing has been submitted.
            </p>
          ) : null}
          {handoffError || handoff.error ? (
            <p role="alert" className="text-danger mb-3 text-sm">
              {handoffError || handoff.error?.message}
            </p>
          ) : null}
          <SymptomComposer
            minLength={1}
            key={seedKey}
            defaultValue={seed}
            focusOnMount={seedKey > 0}
            focusRequest={focusRequest}
            onSubmit={ask}
            isSubmitting={answer.isPending || handoff.isPending}
            submitLabel="Send"
            label={starterPrompt || (hasThread ? 'Your next message' : 'Your question')}
            hint=""
            placeholder={
              hasThread
                ? 'Ask a follow-up or add a detail…'
                : 'Type your question or describe what you see…'
            }
          />
          <AiDisclosure compact className="mt-2" />
        </div>
      </section>
      <aside
        id="answer-context"
        aria-labelledby="sources-heading"
        className={cn(
          'border-border bg-canvas min-h-0 min-w-0 flex-col lg:border-l',
          mobilePanel === 'context' ? 'flex' : 'hidden lg:flex',
        )}
      >
        <div className="flex min-h-14 shrink-0 items-center justify-between gap-2 px-4 sm:px-6">
          <h2
            id="sources-heading"
            ref={sourcesHeadingRef}
            tabIndex={-1}
            className="focus-visible:outline-focus text-sm font-semibold focus-visible:outline-2"
          >
            Sources & context
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => {
              setMobilePanel('conversation');
            }}
          >
            <ArrowLeft className="size-4" aria-hidden /> Back to chat
          </Button>
          <BookOpen className="text-text-subtle hidden size-4 lg:block" aria-hidden />
        </div>
        <div
          className="min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain px-4 pt-3 pb-6 sm:px-6"
          role="region"
          // Independently scrolling evidence must remain keyboard reachable.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          aria-label="Source documents and machine context"
        >
          <section aria-label="Answer sources">
            {activeAnswer ? (
              <>
                <p className="text-text-muted text-xs font-medium">
                  {activeIndex === latestAnswerIndex ? 'Latest answer' : 'Earlier answer'}
                </p>
                {activeQuestion?.role === 'user' ? (
                  <p className="text-text mt-2 line-clamp-3 text-sm leading-relaxed break-words">
                    {activeQuestion.text}
                  </p>
                ) : null}
                {citations.length > 0 ? (
                  <ol className="divide-border border-border mt-4 divide-y border-y">
                    {citations.map((citation, index) => (
                      <li key={citation.id}>
                        <a
                          href={citation.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group focus-visible:outline-focus flex min-h-11 items-start gap-3 py-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          <span className="border-border bg-bg text-text-muted flex size-6 shrink-0 items-center justify-center rounded-sm border font-mono text-xs">
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="group-hover:text-accent block text-sm leading-relaxed font-medium break-words">
                              {citation.label}
                            </span>
                            <span className="text-text-muted mt-1 block text-xs">
                              {citation.ref ?? 'Open document'} · Opens in a new tab
                            </span>
                          </span>
                          <ArrowUpRight
                            className="text-text-subtle mt-1 size-3.5 shrink-0"
                            aria-hidden
                          />
                        </a>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-text-muted mt-4 text-sm leading-relaxed">
                    {activeAnswer.needsClarification
                      ? activeAnswer.clarifyOptions.length > 0
                        ? 'Choose a clarification in the conversation to continue.'
                        : 'This reply has no document references.'
                      : 'No document sources were attached to this answer. Confirm missing details with your OEM.'}
                  </p>
                )}
                {activeIndex !== latestAnswerIndex ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    onClick={() => setSelectedIndex(null)}
                  >
                    Return to latest answer
                  </Button>
                ) : null}
              </>
            ) : (
              <div className="py-3">
                <FileText className="text-text-subtle mb-4 size-6" aria-hidden />
                <h3 className="text-base font-medium">Read alongside the answer</h3>
                <p className="text-text-muted mt-2 text-sm leading-relaxed">
                  When an answer includes sources, its documents and page references appear here.
                  Open the original to check the details.
                </p>
              </div>
            )}
          </section>
          {machine ? (
            <section aria-label="Machine context">
              <h3 className="text-text-muted mb-4 text-xs font-medium">Machine context</h3>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-text-subtle text-xs">Model</dt>
                  <dd className="mt-1 font-medium break-words">{machine.modelName}</dd>
                </div>
                <div>
                  <dt className="text-text-subtle text-xs">Serial</dt>
                  <dd className="mt-1 font-mono break-all">{machine.serialNumber}</dd>
                </div>
                <div>
                  <dt className="text-text-subtle text-xs">Family</dt>
                  <dd className="mt-1 break-words">{machine.familyName}</dd>
                </div>
              </dl>
            </section>
          ) : null}
          <div className="flex flex-col items-start gap-2">
            <Button asChild variant="secondary" size="sm" className="w-full">
              <Link
                href={routes.machineManuals(serialId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <BookOpen className="size-4" aria-hidden /> Browse machine manuals
                <ArrowUpRight className="ml-auto size-3.5" aria-hidden />
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>
            </Button>
            {ability?.can('create', 'Case') ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                disabled={answer.isPending || handoff.isPending}
                onClick={contactSupport}
              >
                <MessageSquare className="size-4" aria-hidden />{' '}
                {handoff.isPending ? 'Preparing report…' : 'Review support request'}
              </Button>
            ) : null}
          </div>
          <p className="text-text-subtle text-xs leading-relaxed">
            This conversation isn’t saved after a refresh. Open sources in a new tab to keep your
            place.
          </p>
        </div>
      </aside>
    </div>
  );
}

function AssistantTurn({
  data,
  onContactSupport,
  preparingDraft,
  canContactSupport,
  selected,
  isLast,
  onSources,
  onClarify,
  disabled,
}: {
  data: AnswerData;
  onContactSupport: () => void;
  preparingDraft: boolean;
  canContactSupport: boolean;
  selected: boolean;
  isLast: boolean;
  onSources: () => void;
  onClarify: (id: string) => void;
  disabled: boolean;
}): JSX.Element {
  const citations = toCitations(data.citations);
  return (
    <article className="min-w-0" aria-label="Assistant answer">
      <div className="mb-3 flex items-center gap-2.5">
        <LogoMark size={20} glow={false} />
        <span className="text-sm font-semibold">ArgonIQ</span>
        <span className="text-text-muted text-xs">AI assistant</span>
      </div>
      <div className="max-w-prose text-base leading-relaxed">
        {data.needsClarification ? (
          <>
            <p className="mb-3">{data.customerMessage}</p>
            <Inline gap={2} wrap>
              {data.clarifyOptions.map((option) => (
                <Button
                  key={option.symptomId}
                  variant="secondary"
                  size="sm"
                  onClick={() => onClarify(option.symptomId)}
                  disabled={disabled || !isLast}
                >
                  {option.label}
                </Button>
              ))}
            </Inline>
          </>
        ) : (
          <AnswerView
            zone={data.safetyZone}
            text={data.customerMessage}
            showSafetyZone={data.safetyZone !== 'GREEN'}
          />
        )}
        {data.rankedCauses?.length ? (
          <div className="mt-5">
            <Text size="sm" weight="medium" className="mb-2">
              Possible causes
            </Text>
            <CauseRankingList
              showConfidence={false}
              causes={data.rankedCauses.map((cause) => ({
                key: cause.key,
                label: cause.label,
                confidence: cause.confidence,
              }))}
            />
          </div>
        ) : null}
        {!data.caseId &&
        canContactSupport &&
        (data.answerMode === 'E' || data.answerMode === 'F') ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-4"
            disabled={disabled}
            onClick={onContactSupport}
          >
            {preparingDraft ? 'Preparing report…' : 'Review support request'}
          </Button>
        ) : null}
        {data.caseId ? (
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link href={`${routes.cases}/${data.caseId}`} target="_blank" rel="noopener noreferrer">
              Open support case
              <ArrowUpRight className="size-3.5" aria-hidden />
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>
          </Button>
        ) : null}
        {data.internalNote ? (
          <details className="border-border mt-5 border-l-2 pl-4">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
              Internal note · staff only
            </summary>
            <Markdown>{data.internalNote}</Markdown>
          </details>
        ) : null}
      </div>
      {!data.needsClarification ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant={selected ? 'secondary' : 'ghost'}
            size="sm"
            onClick={onSources}
            aria-controls="answer-context"
          >
            <FileText className="size-3.5" aria-hidden />
            {citations.length
              ? `${citations.length} ${citations.length === 1 ? 'source' : 'sources'}`
              : 'Source details'}
            <ChevronRight className="size-3.5" aria-hidden />
          </Button>
          {data.confidence === 'LOW' ? (
            <span className="text-text-muted text-xs">Limited supporting information</span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
