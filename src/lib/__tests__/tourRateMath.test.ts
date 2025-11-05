import { describe, expect, it } from 'vitest';

import { calculateQuoteTotal } from '../tourRateMath';

describe('calculateQuoteTotal', () => {
  it('returns total_with_extras_eur when provided', () => {
    const total = calculateQuoteTotal({
      total_with_extras_eur: 150,
      total_eur: 120,
      extras_total_eur: 30,
    });

    expect(total).toBe(150);
  });

  it('falls back to base plus extras when total_with_extras_eur is missing', () => {
    const total = calculateQuoteTotal({
      total_with_extras_eur: undefined,
      total_eur: 120,
      extras_total_eur: 30,
    });

    expect(total).toBe(150);
  });

  it('avoids double counting tiny rounding extras when total_with_extras_eur is missing', () => {
    const total = calculateQuoteTotal({
      total_with_extras_eur: undefined,
      total_eur: 100,
      extras_total_eur: 0.005,
    });

    expect(total).toBe(100);
  });
});
