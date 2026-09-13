/**
 * Schema barrel — the full Drizzle schema. Imported as a namespace by the client
 * (`drizzle(client, { schema })`) and re-exported flat for query builders.
 */
export * from './_shared.js';
export * from './auth.js';
export * from './tenants.js';
export * from './companies.js';
export * from './sites.js';
export * from './contacts.js';
export * from './machine-families.js';
export * from './machine-models.js';
export * from './variant-axes.js';
export * from './installations.js';
export * from './serials.js';
export * from './option-defs.js';
export * from './serial-options.js';
export * from './option-constraints.js';
export * from './documents.js';
export * from './symptoms.js';
export * from './playbooks.js';
export * from './cases.js';
export * from './memberships.js';
export * from './audit-log.js';

export * from './case-evidence.js';
