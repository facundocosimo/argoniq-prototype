import { describe, expect, it } from 'vitest';
import { isCredentialIsolated, isCustomerCitable, isInCustomerChannel } from './knowledge-tier.js';

describe('knowledge tiers', () => {
  it('only T1/T2 are customer-citable', () => {
    expect(isCustomerCitable('T1')).toBe(true);
    expect(isCustomerCitable('T2')).toBe(true);
    expect(isCustomerCitable('T3')).toBe(false);
    expect(isCustomerCitable('T4')).toBe(false);
  });

  it('the customer generation channel excludes T3/T4 (two-channel design)', () => {
    expect(isInCustomerChannel('T3')).toBe(false);
    expect(isInCustomerChannel('T4')).toBe(false);
  });

  it('only T4 is credential-isolated', () => {
    expect(isCredentialIsolated('T4')).toBe(true);
    expect(isCredentialIsolated('T3')).toBe(false);
  });
});
