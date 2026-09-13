import { type TenantId } from '@argoniq/core-domain';
import { type Actor, createPolicyEngine, type PolicyEngine } from '@argoniq/auth';
import { type Database, getDatabase, type TenantTransaction, withTenant } from '@argoniq/db';
import { type Auditor, createLoggingAuditor, getLogger, type Logger } from '@argoniq/observability';

/**
 * The ServiceContext — the only ambient state a service receives ( *  ). It binds the actor, their tenant, the tenant-scoped db
 * accessor, the policy engine (the T1–T4 tier engine), the auditor, and a logger.
 * No hidden globals: construct it once per entry point and pass it explicitly.
 */
export interface ServiceContext {
  readonly actor: Actor;
  readonly tenantId: TenantId;
  readonly db: Database;
  readonly policy: PolicyEngine;
  readonly auditor: Auditor;
  readonly logger: Logger;
  /** Run a callback inside the actor's tenant scope (RLS GUC set). */
  withTenant<T>(fn: (tx: TenantTransaction) => Promise<T>): Promise<T>;
}

export interface CreateServiceContextOptions {
  readonly actor: Actor;
  /** Override the database (tests). Defaults to the shared application Database. */
  readonly db?: Database;
  /** Override the auditor (tests). Defaults to the logging auditor. */
  readonly auditor?: Auditor;
}

export function createServiceContext(options: CreateServiceContextOptions): ServiceContext {
  const { actor } = options;
  const db = options.db ?? getDatabase();
  const auditor = options.auditor ?? createLoggingAuditor();
  const policy = createPolicyEngine(actor, auditor);
  const logger = getLogger();

  return {
    actor,
    tenantId: actor.tenantId,
    db,
    policy,
    auditor,
    logger,
    withTenant<T>(fn: (tx: TenantTransaction) => Promise<T>): Promise<T> {
      return withTenant(db, actor.tenantId, fn);
    },
  };
}
