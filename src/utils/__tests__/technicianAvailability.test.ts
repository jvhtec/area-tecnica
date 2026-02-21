/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { datesOverlap } from '@/utils/technicianAvailability';

describe('datesOverlap', () => {
  describe('overlapping ranges', () => {
    it('returns true when ranges are identical', () => {
      expect(datesOverlap(
        '2024-05-01T10:00:00Z',
        '2024-05-01T20:00:00Z',
        '2024-05-01T10:00:00Z',
        '2024-05-01T20:00:00Z'
      )).toBe(true);
    });

    it('returns true when second range starts within first range', () => {
      // First: 10:00-20:00, Second: 15:00-22:00
      expect(datesOverlap(
        '2024-05-01T10:00:00Z',
        '2024-05-01T20:00:00Z',
        '2024-05-01T15:00:00Z',
        '2024-05-01T22:00:00Z'
      )).toBe(true);
    });

    it('returns true when second range ends within first range', () => {
      // First: 10:00-20:00, Second: 08:00-15:00
      expect(datesOverlap(
        '2024-05-01T10:00:00Z',
        '2024-05-01T20:00:00Z',
        '2024-05-01T08:00:00Z',
        '2024-05-01T15:00:00Z'
      )).toBe(true);
    });

    it('returns true when second range is fully contained in first', () => {
      // First: 10:00-20:00, Second: 12:00-18:00
      expect(datesOverlap(
        '2024-05-01T10:00:00Z',
        '2024-05-01T20:00:00Z',
        '2024-05-01T12:00:00Z',
        '2024-05-01T18:00:00Z'
      )).toBe(true);
    });

    it('returns true when first range is fully contained in second', () => {
      // First: 12:00-18:00, Second: 10:00-20:00
      expect(datesOverlap(
        '2024-05-01T12:00:00Z',
        '2024-05-01T18:00:00Z',
        '2024-05-01T10:00:00Z',
        '2024-05-01T20:00:00Z'
      )).toBe(true);
    });

    it('returns true when ranges overlap by one minute', () => {
      // First: 10:00-15:00, Second: 15:00-20:00 (edge case - end equals start)
      expect(datesOverlap(
        '2024-05-01T10:00:00Z',
        '2024-05-01T15:00:00Z',
        '2024-05-01T15:00:00Z',
        '2024-05-01T20:00:00Z'
      )).toBe(true);
    });
  });

  describe('non-overlapping ranges', () => {
    it('returns false when second range is entirely before first', () => {
      // First: 15:00-20:00, Second: 08:00-14:00
      expect(datesOverlap(
        '2024-05-01T15:00:00Z',
        '2024-05-01T20:00:00Z',
        '2024-05-01T08:00:00Z',
        '2024-05-01T14:00:00Z'
      )).toBe(false);
    });

    it('returns false when second range is entirely after first', () => {
      // First: 08:00-14:00, Second: 15:00-20:00
      expect(datesOverlap(
        '2024-05-01T08:00:00Z',
        '2024-05-01T14:00:00Z',
        '2024-05-01T15:00:00Z',
        '2024-05-01T20:00:00Z'
      )).toBe(false);
    });

    it('returns false for jobs on different days', () => {
      expect(datesOverlap(
        '2024-05-01T10:00:00Z',
        '2024-05-01T20:00:00Z',
        '2024-05-02T10:00:00Z',
        '2024-05-02T20:00:00Z'
      )).toBe(false);
    });
  });

  describe('multi-day jobs', () => {
    it('returns true for multi-day job overlapping single day', () => {
      // Job 1: May 1-3, Job 2: May 2 only
      expect(datesOverlap(
        '2024-05-01T10:00:00Z',
        '2024-05-03T20:00:00Z',
        '2024-05-02T10:00:00Z',
        '2024-05-02T20:00:00Z'
      )).toBe(true);
    });

    it('returns true for two multi-day jobs overlapping', () => {
      // Job 1: May 1-3, Job 2: May 2-4
      expect(datesOverlap(
        '2024-05-01T10:00:00Z',
        '2024-05-03T20:00:00Z',
        '2024-05-02T10:00:00Z',
        '2024-05-04T20:00:00Z'
      )).toBe(true);
    });

    it('returns false for multi-day jobs on different weeks', () => {
      // Job 1: May 1-3, Job 2: May 8-10
      expect(datesOverlap(
        '2024-05-01T10:00:00Z',
        '2024-05-03T20:00:00Z',
        '2024-05-08T10:00:00Z',
        '2024-05-10T20:00:00Z'
      )).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles ISO strings with milliseconds', () => {
      expect(datesOverlap(
        '2024-05-01T10:00:00.000Z',
        '2024-05-01T20:00:00.000Z',
        '2024-05-01T15:00:00.000Z',
        '2024-05-01T22:00:00.000Z'
      )).toBe(true);
    });

    it('handles jobs that cross midnight', () => {
      // Job 1: 20:00 May 1 - 02:00 May 2, Job 2: 22:00 May 1 - 04:00 May 2
      expect(datesOverlap(
        '2024-05-01T20:00:00Z',
        '2024-05-02T02:00:00Z',
        '2024-05-01T22:00:00Z',
        '2024-05-02T04:00:00Z'
      )).toBe(true);
    });

    it('handles very long festival-type jobs', () => {
      // Festival: May 1-7, Single day: May 4
      expect(datesOverlap(
        '2024-05-01T10:00:00Z',
        '2024-05-07T23:00:00Z',
        '2024-05-04T10:00:00Z',
        '2024-05-04T23:00:00Z'
      )).toBe(true);
    });
  });
});
