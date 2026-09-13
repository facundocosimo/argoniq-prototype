import { type PlatformPrincipal } from '@argoniq/auth';
import { type Database, getDatabase } from '@argoniq/db';
import { type Auditor, createLoggingAuditor, getLogger, type Logger } from '@argoniq/observability';

/**
 * The PlatformContext — the ambient state for platform-operator (super-admin)
 * services. Deliberately smaller than `ServiceContext`: there is no tenant, no
 * `withTenant`, and no tenant policy engine, because the platform surface operates
 * ABOVE tenants on the un-RLS'd `tenants` table only. Authorization is structural —
 * this context exists solely for a resolved `PlatformPrincipal`, and only the
 * `platformProcedure` transport hands it out. To reach an OEM's data, the operator
 * impersonates (mints a tenant `Actor`), which flows through the normal
 * `ServiceContext` + RLS instead.
 */
export interface PlatformContext {
  readonly principal: PlatformPrincipal;
  readonly db: Database;
  readonly auditor: Auditor;
  readonly logger: Logger;
}

export interface CreatePlatformContextOptions {
  readonly principal: PlatformPrincipal;
  readonly db?: Database;
  readonly auditor?: Auditor;
}

export function createPlatformContext(options: CreatePlatformContextOptions): PlatformContext {
  return {
    principal: options.principal,
    db: options.db ?? getDatabase(),
    auditor: options.auditor ?? createLoggingAuditor(),
    logger: getLogger(),
  };
}
