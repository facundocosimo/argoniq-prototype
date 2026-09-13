/**
 * Catalog services — the OEM's product/type catalog (Catalog Studio): families,
 * models, and variant axes. The equipment-option catalog (`OptionDef`) lives with the
 * serial option machinery in `../machine/option-defs.js` but shares the same `Catalog`
 * authorization subject. Each service follows validate → authorize → act → audit.
 */
export * from './families.js';
export * from './models.js';
export * from './variant-axes.js';
