/**
 * Shared zod preprocessors for management write DTOs. HTML form fields yield `''`
 * for "empty", but the domain wants `undefined`/`null` — normalizing here means every
 * optional catalog/installed-base input treats a blank field identically, and no
 * entity re-defines these one-off. Used by the catalog and equipment-option DTOs.
 */

/** Coerce an empty string (or null) to `undefined` — for `.optional()` fields. */
export const emptyToUndefined = (value: unknown): unknown =>
  value === '' || value === null ? undefined : value;

/** Coerce an empty string (or undefined) to `null` — for `.nullable()` fields. */
export const emptyToNull = (value: unknown): unknown =>
  value === '' || value === undefined ? null : value;
