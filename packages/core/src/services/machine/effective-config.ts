import { type ConfidenceBand, EffectiveConfig } from '@argoniq/core-domain';
import { type SerialRow, type VariantAxisRow } from '@argoniq/db';

const BAND_RANK: Record<ConfidenceBand, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/** Weakest-link: a config is only as trustworthy as its least-certain attribute. */
function weakestLink(bands: ConfidenceBand[]): ConfidenceBand {
  if (bands.length === 0) return 'HIGH';
  return bands.reduce((worst, band) => (BAND_RANK[band] < BAND_RANK[worst] ? band : worst), 'HIGH');
}

/**
 * Build a serial's EffectiveConfig from its resolved option values and the
 * model's variant axes (step 2, P3). PURE — no I/O — so it is
 * unit-testable in isolation; the service layer loads the inputs.
 *
 * Config is treated as evidence with confidence: an axis the serial actually
 * resolves is `as_built` / HIGH; an axis with no value falls back to `default` /
 * LOW, which lowers the overall confidence and signals "ask the customer" rather
 * than silently assuming.
 */
export function buildEffectiveConfig(serial: SerialRow, axes: VariantAxisRow[]): EffectiveConfig {
  const attributes = axes.map((axis) => {
    const raw = serial.optionValues[axis.key];
    const present = raw !== undefined && raw !== null;
    return {
      key: axis.key,
      label: axis.label,
      value: present ? raw : '(unset)',
      source: present ? ('as_built' as const) : ('default' as const),
      confidence: present ? ('HIGH' as const) : ('LOW' as const),
    };
  });

  if (serial.firmwareVersion) {
    attributes.push({
      key: 'firmware_version',
      label: 'Firmware version',
      value: serial.firmwareVersion,
      source: 'as_built',
      confidence: 'HIGH',
    });
  }

  // Parse to brand the ids and validate the assembled object in one pass.
  return EffectiveConfig.parse({
    serialId: serial.id,
    modelId: serial.modelId,
    familyId: serial.familyId,
    resolvedAt: new Date(),
    attributes,
    overallConfidence: weakestLink(attributes.map((attribute) => attribute.confidence)),
  });
}
