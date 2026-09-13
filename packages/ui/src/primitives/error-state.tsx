import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { Heading, Text } from './typography.js';
import { Stack } from './layout.js';

/**
 * ErrorState  — the canonical "this failed" surface, mirroring
 * EmptyState. Calm, not alarming: a muted danger glyph, plain-language copy, an
 * optional correlation id for support, and an optional retry action. Used by the
 * route-level error boundaries. It shows only the SAFE error message + correlation
 * id from the envelope — never internal error text (those are non-exposed).
 */
export type ErrorStateProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  description?: string;
  /** Correlation id from the error envelope — shown small so support can trace it. */
  correlationId?: string;
  /** A primary action (e.g. a "Try again" Button wired to the boundary `reset`). */
  action?: ReactNode;
};

export const ErrorState = forwardRef<HTMLDivElement, ErrorStateProps>(function ErrorState(
  {
    className,
    title = 'Something went wrong',
    description = 'An unexpected error occurred. You can try again, or contact support if it persists.',
    correlationId,
    action,
    ...props
  },
  ref,
) {
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(
        'border-border flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center',
        className,
      )}
      {...props}
    >
      <Stack gap={3} align="center">
        <span className="text-zone-red" aria-hidden>
          <AlertTriangle className="size-6" />
        </span>
        <Heading level={4} as="h2">
          {title}
        </Heading>
        <Text size="sm" tone="muted" className="max-w-prose">
          {description}
        </Text>
        {correlationId ? (
          <Text as="span" size="xs" tone="subtle" className="nums-tabular">
            Reference: {correlationId}
          </Text>
        ) : null}
        {action ? <div className="pt-1">{action}</div> : null}
      </Stack>
    </div>
  );
});
