'use client';

import { useCallback, useEffect, useMemo, useRef, type JSX, type KeyboardEvent } from 'react';
import { z } from 'zod';
import { ArrowUp } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { Kbd } from '../primitives/kbd.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useZodForm,
} from '../primitives/form.js';

/**
 * SymptomComposer (stage 1). The shop-floor entry point: describe a
 * symptom, ask a question, or check a parameter in plain language. A single premium
 * "input surface" — one bordered well that carries the focus ring, a single
 * auto-growing field, and an integrated send affordance in the corner (Enter to send,
 * ⇧⏎ for a new line). Built on the centralized Form system (react-hook-form + a zod
 * schema) so validation stays consistent and accessible; the parent owns submission
 * (the real `intelligence.answer` mutation).
 */
export type SymptomComposerProps = {
  onSubmit: (symptom: string) => void;
  /** Visible field label; placeholder examples never replace it. */
  label?: string;
  isSubmitting?: boolean;
  placeholder?: string;
  /** Submit-button label (intent-neutral — the door takes questions, not only problems). */
  submitLabel?: string;
  /** Submitting-state label. */
  submittingLabel?: string;
  /** Helper line under the field. */
  hint?: string;
  minLength?: number;
  /** Seed the field (e.g. from a suggestion chip); remount with a new `key` to re-seed. */
  defaultValue?: string;
  /** Focus the field on mount (used when opening from a suggestion). */
  focusOnMount?: boolean;
  /** Increment to focus the existing field without replacing the user's draft. */
  focusRequest?: number;
  /** `hero` is the larger, centered first-question surface; `default` is the sticky follow-up bar. */
  variant?: 'hero' | 'default';
};

const MAX_HEIGHT = 220;

export function SymptomComposer({
  onSubmit,
  label = 'Your question or observation',
  isSubmitting = false,
  placeholder = 'Ask a question, check a parameter, or describe a problem — for this machine. Include any alarm code and when it started.',
  submitLabel = 'Get answer',
  submittingLabel = 'Working…',
  hint = 'Be specific — a clear question or observation gets a better, cited answer.',
  minLength = 4,
  defaultValue = '',
  focusOnMount = false,
  focusRequest = 0,
  variant = 'default',
}: SymptomComposerProps): JSX.Element {
  const schema = useMemo(
    () =>
      z.object({
        symptom: z
          .string()
          .trim()
          .min(
            minLength,
            minLength === 1
              ? 'Enter a message to send.'
              : `Add a little more detail (at least ${minLength} characters).`,
          ),
      }),
    [minLength],
  );
  const form = useZodForm(schema, { defaultValues: { symptom: defaultValue } });
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const autosize = useCallback((el: HTMLTextAreaElement | null): void => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, []);

  // Size to any seeded value and (optionally) focus the caret at its end on mount.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    autosize(el);
    if (focusOnMount || focusRequest > 0) {
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
  }, [autosize, focusOnMount, focusRequest]);

  const submit = form.handleSubmit((values) => {
    onSubmit(values.symptom);
    form.reset({ symptom: '' });
    if (taRef.current) taRef.current.style.height = 'auto';
  });

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    // ⏎ sends, ⇧⏎ inserts a newline — the modern chat convention.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!isSubmitting) void submit();
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-2">
        <FormField
          control={form.control}
          name="symptom"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-text-muted mb-2 block text-xs font-medium">
                {label}
              </FormLabel>
              <div
                className={cn(
                  'group border-border bg-bg relative flex flex-col rounded-lg border',
                  'ease-out-fast transition-[border-color,box-shadow] duration-150',
                  'hover:border-border-strong',
                  'focus-within:border-accent focus-within:shadow-sm',
                  'focus-within:ring-accent/20 focus-within:ring-2',
                )}
              >
                <FormControl>
                  <textarea
                    {...field}
                    ref={(el) => {
                      field.ref(el);
                      taRef.current = el;
                    }}
                    onChange={(event) => {
                      field.onChange(event);
                      autosize(event.currentTarget);
                    }}
                    onKeyDown={handleKeyDown}
                    rows={variant === 'hero' ? 2 : 1}
                    placeholder={placeholder}
                    aria-label="Ask a question or describe a problem"
                    className={cn(
                      'text-text placeholder:text-text-subtle w-full resize-none bg-transparent',
                      '[@media(max-height:600px)]:min-h-14 [@media(max-height:600px)]:pr-16',
                      'focus:outline-none',
                      variant === 'hero'
                        ? 'text-md px-4 pt-3.5 pb-1'
                        : 'px-3.5 pt-3 pb-1 text-[16px] sm:text-base',
                    )}
                    style={{ maxHeight: MAX_HEIGHT }}
                  />
                </FormControl>
                <div className="flex items-end justify-between gap-3 px-2.5 pt-1 pb-2.5 [@media(max-height:600px)]:absolute [@media(max-height:600px)]:right-0 [@media(max-height:600px)]:bottom-0">
                  <span className="text-text-subtle hidden min-w-0 items-center gap-1.5 pl-1 text-xs sm:flex [@media(max-height:600px)]:hidden">
                    <Kbd>↵</Kbd>
                    <span className="truncate">to send · ⇧↵ new line</span>
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    aria-label={isSubmitting ? submittingLabel : submitLabel}
                    className={cn(
                      'ml-auto inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md sm:min-h-9 [@media(pointer:coarse)]:min-h-11',
                      'bg-accent text-accent-contrast font-medium shadow-xs',
                      'ease-out-fast transition-[background-color,opacity] duration-150',
                      'hover:bg-accent-hover',
                      'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
                      'disabled:pointer-events-none disabled:opacity-50',
                      variant === 'hero' ? 'h-9 px-3.5 text-sm' : 'h-8 px-3 text-sm',
                    )}
                  >
                    <span className="hidden sm:inline">
                      {isSubmitting ? submittingLabel : submitLabel}
                    </span>
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        {hint ? <span className="text-text-subtle px-1 text-xs">{hint}</span> : null}
      </form>
    </Form>
  );
}
