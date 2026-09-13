import { type HTMLAttributes, type JSX, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { Heading, Text } from '../primitives/typography.js';

/**
 * Standard page layouts  — every route composes the same structure,
 * so spacing, max-width, and the title/actions pattern are consistent and
 * responsive by default (no bespoke per-page chrome). Three pieces:
 *   PageContainer → centered, width-capped, responsive padding
 *   PageHeader    → back slot · title · description · meta · right-aligned actions
 *   PageSection   → an optional titled block within the page
 */

export type PageContainerProps = HTMLAttributes<HTMLDivElement>;

/**
 * The one content container  — full-width with consistent responsive
 * padding. Every page reuses it identically, so content width
 * never drifts from one page to the next.
 */
export function PageContainer({ className, ...props }: PageContainerProps): JSX.Element {
  return <div className={cn('w-full px-4 py-4 sm:px-6 lg:px-8', className)} {...props} />;
}

export type PageHeaderProps = {
  /** Page title — a string is rendered as the h1, or pass your own node. */
  title: ReactNode;
  description?: ReactNode;
  /** Compact back control beside the title (the app supplies the framework Link). */
  back?: ReactNode;
  /** Status beside the title; wraps with the title at narrow widths. */
  status?: ReactNode;
  /** Record identifiers or other useful context directly under the title. */
  meta?: ReactNode;
  /** Right-aligned actions (buttons, menus). */
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  back,
  status,
  meta,
  actions,
  className,
}: PageHeaderProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2',
        className,
      )}
    >
      <div className="flex min-w-0 basis-full items-center gap-3 sm:flex-1 sm:basis-0">
        {back ? <div className="shrink-0">{back}</div> : null}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {typeof title === 'string' ? (
              <Heading level={2} as="h1">
                {title}
              </Heading>
            ) : (
              title
            )}
            {status ? <div className="flex items-center text-sm">{status}</div> : null}
          </div>
          {typeof description === 'string' ? (
            <Text size="sm" tone="muted">
              {description}
            </Text>
          ) : (
            description
          )}
          {meta ? <div className="pt-0.5">{meta}</div> : null}
        </div>
      </div>
      {actions ? (
        <div
          role="group"
          aria-label="Page actions"
          className="flex max-w-full flex-wrap items-center gap-2"
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export type PageSectionProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageSection({
  title,
  description,
  actions,
  className,
  children,
  ...props
}: PageSectionProps): JSX.Element {
  const hasHeader = Boolean(title) || Boolean(description) || Boolean(actions);
  return (
    <section className={cn('flex flex-col gap-3', className)} {...props}>
      {hasHeader ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-0.5">
            {typeof title === 'string' ? (
              <Heading level={3} as="h2">
                {title}
              </Heading>
            ) : (
              title
            )}
            {typeof description === 'string' ? (
              <Text size="sm" tone="muted">
                {description}
              </Text>
            ) : (
              description
            )}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
