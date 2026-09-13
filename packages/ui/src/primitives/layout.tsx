import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn.js';

/**
 * Layout primitives. Stack (vertical) and Inline (horizontal)
 * compose spacing strictly on the 4px scale via the `gap` token — no ad-hoc
 * margins in features. Presentational, so server-compatible.
 */

const gapVariants = {
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  6: 'gap-6',
  8: 'gap-8',
};

const alignVariants = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

const justifyVariants = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
};

const stackVariants = cva('flex flex-col', {
  variants: { gap: gapVariants, align: alignVariants, justify: justifyVariants },
  defaultVariants: { gap: 4, align: 'stretch', justify: 'start' },
});

const inlineVariants = cva('flex flex-row', {
  variants: {
    gap: gapVariants,
    align: alignVariants,
    justify: justifyVariants,
    wrap: { true: 'flex-wrap', false: 'flex-nowrap' },
  },
  defaultVariants: { gap: 2, align: 'center', justify: 'start', wrap: false },
});

export type StackProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof stackVariants>;

export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack(
  { className, gap, align, justify, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn(stackVariants({ gap, align, justify }), className)} {...props} />
  );
});

export type InlineProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof inlineVariants>;

export const Inline = forwardRef<HTMLDivElement, InlineProps>(function Inline(
  { className, gap, align, justify, wrap, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(inlineVariants({ gap, align, justify, wrap }), className)}
      {...props}
    />
  );
});
