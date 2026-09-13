/**
 * @argoniq/core-domain — the canon vocabulary.
 *
 * The single source of domain truth. Every other package imports
 * its terms from here; no concept is redefined elsewhere. Runtime config lives on
 * the `./env` subpath, deliberately separate from these pure types.
 */
export * from './ids.js';
export * from './knowledge-tier.js';
export * from './document-category.js';
export * from './document-scope.js';
export * from './answer-mode.js';
export * from './safety-zone.js';
export * from './safety-context.js';
export * from './confidence.js';
export * from './roles.js';
export * from './contact-role.js';

export * from './entities/tenant.js';
export * from './entities/company.js';
export * from './entities/case.js';
export * from './entities/site.js';
export * from './entities/contact.js';
export * from './entities/machine-family.js';
export * from './entities/machine-model.js';
export * from './entities/variant.js';
export * from './entities/installation.js';
export * from './entities/serial.js';
export * from './entities/equipment-option.js';
export * from './entities/effective-config.js';

export * from './symptom/ontology.js';
export * from './playbook.js';

export * from './support.js';

export * from './support-draft.js';
