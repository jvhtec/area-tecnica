import { describe, expect, it } from 'vitest';
import { getLegacyStaffingSpanDates } from '../assignmentDates';

describe('legacy Madrid calendar coverage', () => {
  it('includes each autumn DST calendar day exactly once', () => {
    expect(getLegacyStaffingSpanDates('2026-10-23T22:30:00Z', '2026-10-25T23:30:00Z')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
  });
  it('includes the last calendar date when its end time is earlier than the start time', () => {
    expect(getLegacyStaffingSpanDates('2026-10-20T20:00:00Z', '2026-10-21T10:00:00Z')).toEqual(['2026-10-20', '2026-10-21']);
  });
  it('includes each spring DST calendar day exactly once', () => {
    expect(getLegacyStaffingSpanDates('2026-03-27T23:30:00Z', '2026-03-29T22:30:00Z')).toEqual(['2026-03-28', '2026-03-29', '2026-03-30']);
  });
  it.each([[null, null], ['invalid', '2026-10-21'], ['2026-10-20', 'invalid'], ['2026-10-22', '2026-10-20']])('returns empty coverage for invalid bounds %s / %s', (start, end) => {
    expect(getLegacyStaffingSpanDates(start, end)).toEqual([]);
  });
});
