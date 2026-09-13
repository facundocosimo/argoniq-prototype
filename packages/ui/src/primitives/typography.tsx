import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn.js';

/** Presentational typography variants using the shared font and color tokens. */

const headingVariants = cva('font-semibold text-text text-balance', {
  variants: {
    level: {
      1: 'text-2xl tracking-tighter',
      2: 'text-xl tracking-tight',
      3: 'text-lg tracking-tight',
      4: 'text-base tracking-tight',
    },
  },
  defaultVariants: { level: 2 },
});

export type HeadingProps = Omit<HTMLAttributes<HTMLHeadingElement>, 'color'> &
  VariantProps<typeof headingVariants> & {
    /** Render a different heading element than the visual level implies. */
    as?: 'h1' | 'h2' | 'h3' | 'h4';
  };

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
  { className, level = 2, as, ...props },
  ref,
) {
  const Tag = as ?? `h${level ?? 2}`;
  return <Tag ref={ref} className={cn(headingVariants({ level }), className)} {...props} />;
});

const textVariants = cva('', {
  variants: {
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      md: 'text-md',
      lg: 'text-lg',
    },
    tone: {
      default: 'text-text',
      muted: 'text-text-muted',
      subtle: 'text-text-subtle',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
    },
  },
  defaultVariants: { size: 'base', tone: 'default', weight: 'normal' },
});

export type TextProps = Omit<HTMLAttributes<HTMLParagraphElement>, 'color'> &
  VariantProps<typeof textVariants> & {
    /** Render inline (<span>) instead of a block paragraph. */
    as?: 'p' | 'span';
  };

export const Text = forwardRef<HTMLParagraphElement, TextProps>(function Text(
  { className, size, tone, weight, as = 'p', ...props },
  ref,
) {
  const Tag = as;
  return (
    <Tag ref={ref} className={cn(textVariants({ size, tone, weight }), className)} {...props} />
  );
});
