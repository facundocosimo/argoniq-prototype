import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

/**
 * Card. Border over shadow, radius ≤ 8px (radius-lg). NOT a
 * bubbly card — a calm bordered surface. Composes with CardHeader / CardTitle /
 * CardBody / CardFooter for the canonical list → detail layout. Presentational,
 * so server-compatible.
 */
export type CardProps = HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('border-border bg-bg rounded-lg border shadow-xs', className)}
      {...props}
    />
  );
});

export const CardHeader = forwardRef<HTMLDivElement, CardProps>(function CardHeader(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cn('border-border border-b px-4 py-3', className)} {...props} />;
});

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...props }, ref) {
    return (
      // eslint-disable-next-line jsx-a11y/heading-has-content -- generic primitive; the consumer supplies the heading content as children.
      <h3
        ref={ref}
        className={cn('text-text text-sm font-semibold tracking-tight', className)}
        {...props}
      />
    );
  },
);

export const CardBody = forwardRef<HTMLDivElement, CardProps>(function CardBody(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cn('px-4 py-4', className)} {...props} />;
});

export const CardFooter = forwardRef<HTMLDivElement, CardProps>(function CardFooter(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('border-border flex items-center gap-2 border-t px-4 py-3', className)}
      {...props}
    />
  );
});
