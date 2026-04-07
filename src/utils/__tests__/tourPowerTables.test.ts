import { describe, expect, it } from 'vitest';

import { computePowerTotalVa } from '@/utils/tourPowerTables';

describe('tourPowerTables', () => {
  it('uses the stored power factor when it is within the valid range', () => {
    expect(computePowerTotalVa(950, { pf: 0.95 }, 'sound')).toBe(1000);
  });

  it('falls back to the department default power factor when the stored value is invalid', () => {
    expect(computePowerTotalVa(950, { pf: 2 }, 'sound')).toBe(1000);
    expect(computePowerTotalVa(900, { pf: 0 }, 'video')).toBe(1000);
  });
});
