/**
 * @argoniq/db — data access. The ONLY package that talks to Postgres.
 *
 * Consumers get the `Database`, the tenant-scoped transaction helper, and the
 * schema (flat + as a `schema` namespace). All tenant data access must go through
 * `withTenant`.
 */
export * from './client.js';
export * from './tenant-scope.js';
export * from './schema/index.js';
export * as schema from './schema/index.js';
export * from './repositories/index.js';
export { TENANT_SCOPED_TABLES } from './rls.js';
export * from './repositories/identity-repository.js';
