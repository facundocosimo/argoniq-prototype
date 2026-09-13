'use client';

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
  type JSX,
} from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { IconButton } from './icon-button.js';

/**
 * Dialog  — the single overlay primitive for the whole system:
 * a centered modal (`side="center"`) or an edge sheet (`side="left"|"right"`, used
 * by the mobile nav drawer). Built on Radix Dialog so focus-trap, escape-to-close,
 * scroll-lock, and `aria-modal` semantics are correct by construction. Calm 1px
 * border + a whisper of elevation; a subtle, fast, token-timed entrance (honoring
 * prefers-reduced-motion via the base layer). Token-driven only — no pills, no
 * hard-coded color/px.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn('mm-animate-overlay bg-text/25 fixed inset-0 z-40', className)}
      {...props}
    />
  );
});

const contentVariants = cva(
  cn('fixed z-50 flex flex-col border-border bg-bg shadow-md focus:outline-none'),
  {
    variants: {
      side: {
        center:
          'mm-animate-pop left-1/2 top-1/2 max-h-modal-height w-modal -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border',
        left: 'mm-animate-sheet-left inset-y-0 left-0 w-drawer max-w-drawer border-r',
        right: 'mm-animate-sheet-right inset-y-0 right-0 w-drawer max-w-drawer border-l',
      },
    },
    defaultVariants: { side: 'center' },
  },
);

export type DialogContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> &
  VariantProps<typeof contentVariants> & {
    /** Show the built-in top-right close affordance (centered modals). */
    showClose?: boolean;
    /** Override the overlay class (e.g. to scope a sheet to `md:hidden`). */
    overlayClassName?: string;
  };

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent(
  { className, children, side, showClose = true, overlayClassName, ...props },
  ref,
) {
  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(contentVariants({ side }), className)}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close asChild>
            <IconButton size="sm" aria-label="Close" className="absolute top-3 right-3">
              <X className="size-4" aria-hidden />
            </IconButton>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn('border-border flex flex-col gap-1 border-b px-5 py-4 pr-12', className)}
      {...props}
    />
  );
}

export function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        'mm-dialog-safe-bottom border-border flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-text text-base font-semibold tracking-tight', className)}
      {...props}
    />
  );
});

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-text-muted text-sm', className)}
      {...props}
    />
  );
});
