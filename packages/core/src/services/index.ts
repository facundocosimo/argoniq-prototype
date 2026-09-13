/** Application services grouped by domain. */
export * as machine from './machine/index.js';
export * as installation from './installation/index.js';
export * as company from './company/index.js';
export * as site from './site/index.js';
export * as contact from './contact/index.js';
export * as catalog from './catalog/index.js';
export * as platform from './platform/index.js';
export * as document from './document/index.js';
export * as intelligence from './intelligence/index.js';
export * as serviceCase from './case/index.js';

// Flat re-exports for direct import where a namespace is noise.
export * from './machine/index.js';
export * from './installation/index.js';
export * from './company/index.js';
export * from './site/index.js';
export * from './contact/index.js';
export * from './catalog/index.js';
export * from './platform/index.js';
export * from './document/index.js';
export * from './intelligence/index.js';
export * from './case/index.js';
