'use client';

import { type ReactNode } from 'react';
import { type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { cn } from '../lib/cn.js';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from '../primitives/form.js';
import { Input, type InputProps } from '../primitives/input.js';
import { Textarea, type TextareaProps } from '../primitives/textarea.js';
import { Select } from '../primitives/select.js';
import { Combobox, type ComboboxOption, type ComboboxProps } from '../primitives/combobox.js';

/**
 * Field components  — the one way to render a form field. Each
 * collapses the FormField → FormItem → FormLabel → FormControl → control →
 * FormDescription → FormMessage stack into a single declarative element, so every
 * field across every form has identical spacing, label/error wiring, help-text
 * placement, and accessibility (label association, `aria-invalid`, `aria-describedby`
 * are inherited from the Form primitives). Bind to a react-hook-form `control`;
 * validation is the form's zod schema. Never hand-assemble a field again.
 */

type BaseFieldProps<
  TFieldValues extends FieldValues,
  TTransformedValues extends FieldValues = TFieldValues,
> = {
  control: Control<TFieldValues, unknown, TTransformedValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  /** Help text under the field (also announced to AT via aria-describedby). */
  description?: ReactNode;
  className?: string;
};

/** Single-line text (and text-like: email, number, url…) field. */
export function TextField<
  TFieldValues extends FieldValues,
  TTransformedValues extends FieldValues = TFieldValues,
>({
  control,
  name,
  label,
  description,
  className,
  ...input
}: BaseFieldProps<TFieldValues, TTransformedValues> &
  Omit<InputProps, 'name' | 'defaultValue'>): ReactNode {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} {...input} value={field.value ?? ''} />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Multi-line text field. */
export function TextareaField<
  TFieldValues extends FieldValues,
  TTransformedValues extends FieldValues = TFieldValues,
>({
  control,
  name,
  label,
  description,
  className,
  ...textarea
}: BaseFieldProps<TFieldValues, TTransformedValues> &
  Omit<TextareaProps, 'name' | 'defaultValue'>): ReactNode {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea {...field} {...textarea} value={field.value ?? ''} />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export type SelectOption = { value: string; label: string; disabled?: boolean };

/** Native-select field. Pass `options`; `placeholder` becomes an empty-value first row. */
export function SelectField<
  TFieldValues extends FieldValues,
  TTransformedValues extends FieldValues = TFieldValues,
>({
  control,
  name,
  label,
  description,
  className,
  options,
  placeholder,
  disabled,
  onValueChange,
}: BaseFieldProps<TFieldValues, TTransformedValues> & {
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Side-effect after the value changes — e.g. reset a dependent field (customer → site). */
  onValueChange?: (value: string) => void;
}): ReactNode {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Select
              {...field}
              value={field.value ?? ''}
              disabled={disabled}
              onChange={(event) => {
                field.onChange(event);
                onValueChange?.(event.target.value);
              }}
            >
              {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
              {options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Searchable single-select field — the DRY standard for every entity/enum picker
 * (companies, sites, families, statuses…). Wraps `Combobox`: search-first, rich
 * per-option display (a leading node + label/description), and optional inline create.
 * Pass `onCreate` to offer "Create …" when the query matches nothing.
 */
export function ComboboxField<
  TFieldValues extends FieldValues,
  TTransformedValues extends FieldValues = TFieldValues,
>({
  control,
  name,
  label,
  description,
  className,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  loading,
  searchable,
  onCreate,
  createLabel,
  creating,
  onValueChange,
}: BaseFieldProps<TFieldValues, TTransformedValues> & {
  options: readonly ComboboxOption[];
  placeholder?: string | undefined;
  searchPlaceholder?: string | undefined;
  emptyText?: string | undefined;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  searchable?: boolean | undefined;
  onCreate?: ((query: string) => void) | undefined;
  createLabel?: ((query: string) => string) | undefined;
  creating?: boolean | undefined;
  /** Side-effect after the value changes — e.g. reset a dependent field (customer → site). */
  onValueChange?: ((value: string) => void) | undefined;
}): ReactNode {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <ComboboxControl
            value={typeof field.value === 'string' ? field.value : ''}
            onChange={(value) => {
              field.onChange(value);
              onValueChange?.(value);
            }}
            onBlur={field.onBlur}
            name={field.name}
            options={options}
            placeholder={placeholder}
            searchPlaceholder={searchPlaceholder}
            emptyText={emptyText}
            disabled={disabled}
            loading={loading}
            searchable={searchable}
            onCreate={onCreate}
            createLabel={createLabel}
            creating={creating}
          />
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Binds the field's context ids + invalid state onto the Combobox (Slot can't target its trigger). */
function ComboboxControl(
  props: Omit<ComboboxProps, 'invalid' | 'id' | 'aria-describedby'>,
): ReactNode {
  const { formItemId, formDescriptionId, formMessageId, invalid, error } = useFormField();
  return (
    <Combobox
      {...props}
      id={formItemId}
      invalid={invalid}
      aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
    />
  );
}

/**
 * Boolean toggle field — a labelled `role="switch"` that auto-saves nothing (it just
 * sets the form value). The label sits to the LEFT with the switch trailing, the
 * standard for an inline on/off within a form.
 */
export function SwitchField<
  TFieldValues extends FieldValues,
  TTransformedValues extends FieldValues = TFieldValues,
>({
  control,
  name,
  label,
  description,
  className,
  disabled,
}: BaseFieldProps<TFieldValues, TTransformedValues> & { disabled?: boolean }): ReactNode {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const checked = Boolean(field.value);
        return (
          <FormItem className={cn('flex-row items-start justify-between gap-4', className)}>
            <div className="flex min-w-0 flex-col gap-1">
              <FormLabel className="cursor-pointer">{label}</FormLabel>
              {description ? <FormDescription>{description}</FormDescription> : null}
              <FormMessage />
            </div>
            <FormControl>
              <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                disabled={disabled}
                onClick={() => field.onChange(!checked)}
                onBlur={field.onBlur}
                className={cn(
                  'ease-out-fast mt-0.5 inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full p-0.5 transition-colors duration-150',
                  'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50',
                  checked ? 'bg-accent justify-end' : 'bg-border-strong justify-start',
                )}
              >
                <span className="size-[18px] rounded-full bg-white shadow-sm" aria-hidden />
              </button>
            </FormControl>
          </FormItem>
        );
      }}
    />
  );
}

/**
 * FieldGrid — lays fields side-by-side on desktop and stacks them on mobile (the
 * responsive default for related fields, e.g. Country + Timezone). One or two columns.
 */
export function FieldGrid({
  children,
  columns = 2,
  className,
}: {
  children: ReactNode;
  columns?: 1 | 2;
  className?: string;
}): ReactNode {
  return (
    <div
      className={cn('grid gap-4', columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-1', className)}
    >
      {children}
    </div>
  );
}
