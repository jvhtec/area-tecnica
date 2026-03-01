/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  calculateQuoteTotal,
  getPerJobMultiplier,
  formatMultiplier,
  shouldDisplayMultiplier,
} from '@/lib/tourRateMath';

describe('calculateQuoteTotal', () => {
  describe('with extras', () => {
    it('returns total_with_extras_eur when available', () => {
      const quote = {
        total_with_extras_eur: 150.50,
        total_eur: 100,
        extras_total_eur: 50.50,
      };

      expect(calculateQuoteTotal(quote)).toBe(150.50);
    });

    it('prefers total_with_extras_eur over calculated sum', () => {
      const quote = {
        total_with_extras_eur: 200, // This should be used
        total_eur: 100,
        extras_total_eur: 50, // Sum would be 150, but we use 200
      };

      expect(calculateQuoteTotal(quote)).toBe(200);
    });
  });

  describe('without extras field', () => {
    it('calculates base + extras when total_with_extras_eur is missing', () => {
      const quote = {
        total_eur: 100,
        extras_total_eur: 25,
      };

      expect(calculateQuoteTotal(quote)).toBe(125);
    });

    it('handles zero extras', () => {
      const quote = {
        total_eur: 100,
        extras_total_eur: 0,
      };

      expect(calculateQuoteTotal(quote)).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('handles null values', () => {
      const quote = {
        total_with_extras_eur: null,
        total_eur: 100,
        extras_total_eur: 20,
      };

      expect(calculateQuoteTotal(quote)).toBe(120);
    });

    it('handles undefined values', () => {
      const quote = {
        total_eur: undefined,
        extras_total_eur: undefined,
      };

      expect(calculateQuoteTotal(quote)).toBe(0);
    });

    it('handles NaN values', () => {
      const quote = {
        total_with_extras_eur: NaN,
        total_eur: 100,
        extras_total_eur: 20,
      };

      expect(calculateQuoteTotal(quote)).toBe(120);
    });

    it('ignores negligible extras (below tolerance)', () => {
      const quote = {
        total_eur: 100,
        extras_total_eur: 0.005, // Below 0.01 tolerance
      };

      expect(calculateQuoteTotal(quote)).toBe(100);
    });
  });
});

describe('getPerJobMultiplier', () => {
  describe('per_job_multiplier field', () => {
    it('returns per_job_multiplier when available and positive', () => {
      const quote = {
        per_job_multiplier: 1.5,
        multiplier: 3,
        week_count: 2,
      };

      expect(getPerJobMultiplier(quote)).toBe(1.5);
    });

    it('ignores per_job_multiplier when zero or negative', () => {
      const quote = {
        per_job_multiplier: 0,
        multiplier: 2,
        week_count: 2,
      };

      expect(getPerJobMultiplier(quote)).toBe(1); // 2/2
    });
  });

  describe('calculated multiplier', () => {
    it('calculates multiplier / week_count', () => {
      const quote = {
        multiplier: 4,
        week_count: 4,
      };

      expect(getPerJobMultiplier(quote)).toBe(1);
    });

    it('defaults week_count to 1 if missing', () => {
      const quote = {
        multiplier: 2,
      };

      expect(getPerJobMultiplier(quote)).toBe(2);
    });

    it('ensures minimum week_count of 1', () => {
      const quote = {
        multiplier: 3,
        week_count: 0,
      };

      expect(getPerJobMultiplier(quote)).toBe(3);
    });
  });

  describe('long tours (3+ weeks)', () => {
    it('returns 1 for multiplier=1 on 3+ week tours', () => {
      const quote = {
        multiplier: 1,
        week_count: 3,
      };

      expect(getPerJobMultiplier(quote)).toBe(1);
    });

    it('returns 1 for multiplier=1 on longer tours', () => {
      const quote = {
        multiplier: 1,
        week_count: 5,
      };

      expect(getPerJobMultiplier(quote)).toBe(1);
    });
  });

  describe('no multiplier', () => {
    it('returns undefined when no multiplier available', () => {
      const quote = {};

      expect(getPerJobMultiplier(quote)).toBeUndefined();
    });
  });
});

describe('formatMultiplier', () => {
  it('returns dash for null', () => {
    expect(formatMultiplier(null)).toBe('—');
  });

  it('returns dash for undefined', () => {
    expect(formatMultiplier(undefined)).toBe('—');
  });

  it('returns dash for 1 (no multiplier)', () => {
    expect(formatMultiplier(1)).toBe('—');
  });

  it('returns dash for values very close to 1', () => {
    expect(formatMultiplier(1.00005)).toBe('—');
  });

  it('formats multiplier with × prefix', () => {
    expect(formatMultiplier(1.5)).toBe('×1,50');
  });

  it('formats whole numbers without decimals', () => {
    expect(formatMultiplier(2)).toBe('×2');
  });

  it('formats decimals with 2 decimal places', () => {
    expect(formatMultiplier(1.75)).toBe('×1,75');
  });

  it('uses Spanish locale formatting', () => {
    // Spanish uses comma as decimal separator
    expect(formatMultiplier(2.5)).toBe('×2,50');
  });
});

describe('shouldDisplayMultiplier', () => {
  it('returns false for null', () => {
    expect(shouldDisplayMultiplier(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(shouldDisplayMultiplier(undefined)).toBe(false);
  });

  it('returns false for 1 (no change)', () => {
    expect(shouldDisplayMultiplier(1)).toBe(false);
  });

  it('returns false for values very close to 1', () => {
    expect(shouldDisplayMultiplier(1.00005)).toBe(false);
  });

  it('returns true for values significantly different from 1', () => {
    expect(shouldDisplayMultiplier(1.5)).toBe(true);
    expect(shouldDisplayMultiplier(0.8)).toBe(true);
    expect(shouldDisplayMultiplier(2)).toBe(true);
  });
});
