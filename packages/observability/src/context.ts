import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { type SerialId, type TenantId, type UserId } from '@argoniq/core-domain';

/**
 * Async request context. Carried implicitly across the async call
 * tree so every log line and audit event is automatically tagged with the
 * correlation id and the tenant/user/serial in scope — no manual threading.
 *
 * The store object is mutable: a request begins with just a correlation id, and
 * `updateContext` enriches it as the tenant is resolved, the user authenticates,
 * and a serial comes into scope. The logger reads the live store at emit time.
 */
export type RequestContext = {
  correlationId: string;
  tenantId?: TenantId;
  userId?: UserId;
  serialId?: SerialId;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function newCorrelationId(): string {
  return randomUUID();
}

/** Run `fn` within a fresh context. All async work inside shares it. */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Convenience: start a context with a generated correlation id and run `fn`. */
export function runWithNewContext<T>(seed: Partial<RequestContext>, fn: () => T): T {
  return runWithContext({ correlationId: newCorrelationId(), ...seed }, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Enrich the current context in place (e.g. once the tenant/user is resolved). */
export function updateContext(patch: Partial<Omit<RequestContext, 'correlationId'>>): void {
  const current = storage.getStore();
  if (!current) return;
  Object.assign(current, patch);
}
