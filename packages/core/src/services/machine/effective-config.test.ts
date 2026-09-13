import { describe, expect, it } from 'vitest';
import { type SerialRow, type VariantAxisRow } from '@argoniq/db';
import { buildEffectiveConfig } from './effective-config.js';

const serial = {
  id: '55555555-5555-4555-8555-555555555555',
  modelId: '66666666-6666-4666-8666-666666666666',
  familyId: '77777777-7777-4777-8777-777777777777',
  optionValues: { profile: 'LAB-SANDBOX', sensor_count: 1 },
  firmwareVersion: '2.1.0',
} as unknown as SerialRow;

const axes = [
  { key: 'profile', label: 'Profile' },
  { key: 'sensor_count', label: 'Sensor count' },
  { key: 'inspection_mode', label: 'Inspection mode' },
] as unknown as VariantAxisRow[];

describe('buildEffectiveConfig (  step 2)', () => {
  const config = buildEffectiveConfig(serial, axes);

  it('marks resolved axes as as_built / HIGH', () => {
    const profile = config.attributes.find((a) => a.key === 'profile');
    expect(profile).toMatchObject({ value: 'LAB-SANDBOX', source: 'as_built', confidence: 'HIGH' });
  });

  it('marks unresolved axes as default / LOW (evidence, not fact)', () => {
    const inspectionMode = config.attributes.find((a) => a.key === 'inspection_mode');
    expect(inspectionMode).toMatchObject({
      value: '(unset)',
      source: 'default',
      confidence: 'LOW',
    });
  });

  it('includes firmware as an attribute', () => {
    expect(config.attributes.find((a) => a.key === 'firmware_version')?.value).toBe('2.1.0');
  });

  it('overall confidence is the weakest link', () => {
    // inspection_mode is unset, so LOW drags the whole config down.
    expect(config.overallConfidence).toBe('LOW');
  });
});
