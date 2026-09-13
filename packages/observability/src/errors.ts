import { type z } from 'zod';
import { type ErrorCode, type ErrorEnvelope } from '@argoniq/contracts';

/**
 * Typed error hierarchy. Services throw these; adapters map them
 * to their transport in one place. Never throw bare strings; never swallow.
 *
 * `expose` controls whether `message` is safe to show a client. Isolation/internal
 * errors are NOT exposed — they reveal nothing and are reconstructed from the
 * audit log via `correlationId`.
 */
export type AppErrorOptions = {
  readonly details?: Record<string, unknown>;
  readonly cause?: unknown;
};

export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  /** Whether `message` is safe to expose to a client. Default true. */
  readonly expose: boolean = true;
  readonly details: Record<string, unknown> | undefined;

  constructor(message: string, options?: AppErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.details = options?.details;
  }

  toEnvelope(correlationId?: string): ErrorEnvelope {
    return {
      code: this.code,
      message: this.expose ? this.message : 'An unexpected error occurred.',
      ...(this.details ? { details: this.details } : {}),
      ...(correlationId ? { correlationId } : {}),
    };
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION';

  static fromZod(error: z.ZodError, message = 'Validation failed'): ValidationError {
    return new ValidationError(message, {
      details: {
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }
}

export class UnauthenticatedError extends AppError {
  readonly code = 'UNAUTHENTICATED';
  constructor(message = 'Authentication required', options?: AppErrorOptions) {
    super(message, options);
  }
}

export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN';
  constructor(message = 'You do not have access to this resource', options?: AppErrorOptions) {
    super(message, options);
  }
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  constructor(resource: string, id?: string) {
    super(`${resource} not found`, id ? { details: { resource, id } } : { details: { resource } });
  }
}

export class ConflictError extends AppError {
  readonly code = 'CONFLICT';
}

export class RateLimitedError extends AppError {
  readonly code = 'RATE_LIMITED';
  constructor(message = 'Too many requests', options?: AppErrorOptions) {
    super(message, options);
  }
}

/** A safety refusal (Mode F). Company-safe message; never leaks the unsafe content. */
export class UnsafeRequestError extends AppError {
  readonly code = 'UNSAFE_REQUEST';
  constructor(
    message = 'This action needs a qualified technician and cannot be done from a chat.',
    options?: AppErrorOptions,
  ) {
    super(message, options);
  }
}

/** A customer-facing technical claim could not be bound to a citable source. */
export class GroundingFailedError extends AppError {
  readonly code = 'GROUNDING_FAILED';
  constructor(
    message = 'Unable to ground this answer in an approved source',
    options?: AppErrorOptions,
  ) {
    super(message, options);
  }
}

/** Cross-tenant or cross-scope provenance mismatch. Never exposed. */
export class TenantIsolationError extends AppError {
  readonly code = 'TENANT_ISOLATION';
  override readonly expose = false;
  constructor(message = 'Tenant isolation violation', options?: AppErrorOptions) {
    super(message, options);
  }
}

/** Unexpected failure. Message is never exposed to the client. */
export class InternalError extends AppError {
  readonly code = 'INTERNAL';
  override readonly expose = false;
  constructor(message = 'Internal error', options?: AppErrorOptions) {
    super(message, options);
  }
}
