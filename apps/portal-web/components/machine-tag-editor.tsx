'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, Tag, X } from 'lucide-react';
import { IconButton, Input, Text } from '@argoniq/ui';
import { trpc } from '../lib/trpc/client.js';

/**
 * MachineTagEditor — inline edit of a machine's customer factory tag (the client's
 * own label, e.g. "ATLAS-001"). Reads as quiet typographic identity, not a form: the
 * tag with a reveal-on-hover pencil, or an "Add factory tag" affordance when unset.
 * Editing swaps to a compact input (⏎ saves, Esc cancels); on success it refreshes the
 * server component so the new tag propagates to the header, topbar, and lists.
 */
export function MachineTagEditor({
  serialId,
  initialTag,
}: {
  serialId: string;
  initialTag: string | null;
}): JSX.Element {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialTag ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.machine.setCustomerTag.useMutation({
    onSuccess: () => {
      setEditing(false);
      void utils.machine.getSerialDetail.invalidate({ serialId });
      router.refresh();
    },
  });

  useEffect(() => {
    if (!editing) setValue(initialTag ?? '');
  }, [initialTag, editing]);

  useEffect(() => {
    if (editing) {
      const el = inputRef.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  function save(): void {
    mutation.mutate({ serialId, tag: value.trim() });
  }
  function cancel(): void {
    setValue(initialTag ?? '');
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Tag className="text-text-subtle size-4 shrink-0" aria-hidden />
          <Input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                save();
              } else if (event.key === 'Escape') {
                cancel();
              }
            }}
            placeholder="e.g. ATLAS-001"
            maxLength={100}
            aria-label="Factory tag"
            className="h-11 min-w-0 flex-1 sm:h-8 [@media(pointer:coarse)]:h-11"
          />
          <IconButton
            size="touch"
            variant="subtle"
            aria-label="Save factory tag"
            onClick={save}
            disabled={mutation.isPending}
          >
            <Check className="size-4" aria-hidden />
          </IconButton>
          <IconButton
            size="touch"
            variant="ghost"
            aria-label="Cancel"
            onClick={cancel}
            disabled={mutation.isPending}
          >
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>
        {mutation.error ? (
          <Text size="xs" className="text-danger">
            {mutation.error.message}
          </Text>
        ) : null}
      </div>
    );
  }

  if (initialTag) {
    return (
      <div className="group/tag flex items-center gap-1.5 text-sm">
        <Tag className="text-text-subtle size-3.5 shrink-0" aria-hidden />
        <span className="nums-tabular text-text font-medium">{initialTag}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit factory tag"
          className="text-text-muted hover:bg-surface hover:text-text ml-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-md sm:size-7 [@media(pointer:coarse)]:size-11"
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-text-muted hover:text-text inline-flex min-h-9 w-fit items-center gap-1.5 rounded-sm text-sm transition-colors [@media(pointer:coarse)]:min-h-11"
    >
      <Tag className="size-3.5" aria-hidden />
      Add factory tag
    </button>
  );
}
