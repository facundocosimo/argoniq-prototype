import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn.js';

/**
 * Avatar  — a round identity mark (initials or an icon). One
 * primitive for the user card, brand monogram, and future people surfaces.
 * Decorative by default (aria-hidden); the adjacent label carries meaning.
 */
const avatarVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-medium',
  {
    variants: {
      size: {
        sm: 'size-6 text-xs',
        md: 'size-7 text-xs',
        lg: 'size-9 text-sm',
      },
      tone: {
        neutral: 'bg-surface text-text-muted',
        accent: 'bg-accent text-accent-contrast',
      },
    },
    defaultVariants: { size: 'md', tone: 'neutral' },
  },
);

export type AvatarProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof avatarVariants> & {
    /** Short initials (1–2 chars) shown when no icon is given. */
    initials?: string;
    /** An icon element shown instead of initials. */
    icon?: ReactNode;
  };

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { className, size, tone, initials, icon, children, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      aria-hidden
      className={cn(avatarVariants({ size, tone }), className)}
      {...props}
    >
      {icon ?? initials ?? children}
    </span>
  );
});
