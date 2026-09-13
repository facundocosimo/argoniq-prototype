import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { Heading, Text } from './typography.js';
import { Stack } from './layout.js';

/**
 * EmptyState. The canonical "nothing here yet / no results"
 * surface — calm, centered, content-first, with an optional icon and action. Used
 * across empty case queues, parts lists, and search results so the flow stays
 * ultra-clear (the user always knows what to do next).
 */
export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  /** A small leading icon (e.g. a lucide-react icon element). */
  icon?: ReactNode;
  /** A primary action (e.g. a Button) shown beneath the copy. */
  action?: ReactNode;
};

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  { className, title, description, icon, action, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'border-border flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center',
        className,
      )}
      {...props}
    >
      <Stack gap={3} align="center">
        {icon ? (
          <span className="text-text-muted" aria-hidden>
            {icon}
          </span>
        ) : null}
        <Heading level={4} as="h2">
          {title}
        </Heading>
        {description ? (
          <Text size="sm" tone="muted" className="max-w-prose">
            {description}
          </Text>
        ) : null}
        {action ? <div className="pt-1">{action}</div> : null}
      </Stack>
    </div>
  );
});
