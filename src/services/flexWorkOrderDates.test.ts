import { describe, expect, it } from 'vitest';

import { formatFlexWorkOrderDate } from '@/services/flexWorkOrderDates';

describe('formatFlexWorkOrderDate', () => {
  it('uses the job calendar date instead of the UTC date', () => {
    expect(formatFlexWorkOrderDate('2026-07-10T22:30:00Z', 'Europe/Madrid')).toBe('2026-07-11');
  });

  it('supports non-Madrid job timezones and invalid values', () => {
    expect(formatFlexWorkOrderDate('2026-07-11T01:30:00Z', 'America/New_York')).toBe('2026-07-10');
    expect(formatFlexWorkOrderDate('not-a-date')).toBeNull();
  });
});

