'use client';

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type ComponentPropsWithoutRef,
  type HTMLAttributes,
  type JSX,
} from 'react';
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  type ControllerProps,
  type FieldError,
  type FieldPath,
  type FieldValues,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Slot } from '@radix-ui/react-slot';
import { type z } from 'zod';
import { cn } from '../lib/cn.js';
import { Label } from './label.js';

/**
 * Centralized Form system. One pattern for every form:
 * react-hook-form for state + the same zod schema the service validates with on
 * the server (one schema → client field validation AND server `parseInput`), so
 * client and server can never drift. Accessible by construction — label/control
 * association, `aria-invalid`, and `aria-describedby` are wired from context, not
 * by hand. Token-driven; errors render inline in the danger token (no chips).
 */

/** Build a typed react-hook-form bound to a zod schema (client validation = server schema). */
type FormValues<T> = T extends FieldValues ? T : never;

export function useZodForm<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  props?: Omit<
    UseFormProps<FormValues<z.input<TSchema>>, unknown, FormValues<z.output<TSchema>>>,
    'resolver'
  >,
): UseFormReturn<FormValues<z.input<TSchema>>, unknown, FormValues<z.output<TSchema>>> {
  return useForm<FormValues<z.input<TSchema>>, unknown, FormValues<z.output<TSchema>>>({
    ...props,
    resolver: zodResolver(
      schema as z.ZodType<FormValues<z.output<TSchema>>, FormValues<z.input<TSchema>>>,
    ),
  });
}

/** FormProvider alias — wrap a native `<form>` with `<Form {...form}>`. */
export const Form = FormProvider;

type FormFieldContextValue = { name: string };
const FormFieldContext = createContext<FormFieldContextValue | null>(null);

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TTransformedValues extends FieldValues = TFieldValues,
>(props: ControllerProps<TFieldValues, TName, TTransformedValues>): JSX.Element {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

type FormItemContextValue = { id: string };
const FormItemContext = createContext<FormItemContextValue | null>(null);

type UseFormFieldReturn = {
  id: string;
  name: string;
  formItemId: string;
  formDescriptionId: string;
  formMessageId: string;
  invalid: boolean;
  isDirty: boolean;
  isTouched: boolean;
  error: FieldError | undefined;
};

/** Wiring for one field: stable ids for label/control/description/message + error state. */
export function useFormField(): UseFormFieldReturn {
  const fieldContext = useContext(FormFieldContext);
  const itemContext = useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();
  if (!fieldContext) throw new Error('useFormField must be used within <FormField>');
  if (!itemContext) throw new Error('useFormField must be used within <FormItem>');

  const fieldState = getFieldState(fieldContext.name, formState);
  const { id } = itemContext;
  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-control`,
    formDescriptionId: `${id}-description`,
    formMessageId: `${id}-message`,
    invalid: fieldState.invalid,
    isDirty: fieldState.isDirty,
    isTouched: fieldState.isTouched,
    error: fieldState.error,
  };
}

export const FormItem = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function FormItem({ className, ...props }, ref) {
    const id = useId();
    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn('flex flex-col gap-1.5', className)} {...props} />
      </FormItemContext.Provider>
    );
  },
);

export const FormLabel = forwardRef<HTMLLabelElement, ComponentPropsWithoutRef<typeof Label>>(
  function FormLabel({ className, ...props }, ref) {
    const { error, formItemId } = useFormField();
    return (
      <Label
        ref={ref}
        htmlFor={formItemId}
        className={cn(error ? 'text-danger' : undefined, className)}
        {...props}
      />
    );
  },
);

export const FormControl = forwardRef<HTMLElement, ComponentPropsWithoutRef<typeof Slot>>(
  function FormControl(props, ref) {
    const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
    return (
      <Slot
        ref={ref}
        id={formItemId}
        aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    );
  },
);

export const FormDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(function FormDescription({ className, ...props }, ref) {
  const { formDescriptionId } = useFormField();
  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn('text-text-muted text-sm', className)}
      {...props}
    />
  );
});

export const FormMessage = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function FormMessage({ className, children, ...props }, ref) {
    const { error, formMessageId } = useFormField();
    const body = error ? String(error.message ?? '') : children;
    if (!body) return null;
    return (
      <p
        ref={ref}
        id={formMessageId}
        role="alert"
        className={cn('text-danger text-sm', className)}
        {...props}
      >
        {body}
      </p>
    );
  },
);
