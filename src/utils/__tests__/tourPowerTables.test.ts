import { describe, expect, it } from 'vitest';

import { computePowerTotalVa } from '@/utils/tourPowerTables';

describe('tourPowerTables', () => {
  it('uses the stored power factor when it is within the valid range', () => {
    expect(computePowerTotalVa(950, { pf: 0.95 }, 'sound')).toBe(1000);
  });

  it('uses a stored power factor of 1 without falling back', () => {
    expect(computePowerTotalVa(1000, { pf: 1 }, 'sound')).toBe(1000);
  });

  it('falls back to the department default power factor when the stored value is invalid', () => {
    expect(computePowerTotalVa(950, { pf: 2 }, 'sound')).toBe(1000);
    expect(computePowerTotalVa(900, { pf: 0 }, 'video')).toBe(1000);
    expect(computePowerTotalVa(950, { pf: -1 }, 'sound')).toBe(1000);
  });

  it('returns zero when watts is zero', () => {
    expect(computePowerTotalVa(0, { pf: 0.5 }, 'sound')).toBe(0);
  });

  it('uses department defaults when metadata is null or undefined', () => {
    expect(computePowerTotalVa(950, null, 'sound')).toBe(1000);
    expect(computePowerTotalVa(900, undefined, 'video')).toBe(1000);
  });
});
