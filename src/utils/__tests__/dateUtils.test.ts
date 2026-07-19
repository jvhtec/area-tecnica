/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findClosestFestival, calculatePageForFestival } from '@/utils/dateUtils';

describe('findClosestFestival', () => {
  const createFestival = (id: string, startTime: string) => ({
    id,
    title: `Festival ${id}`,
    start_time: startTime,
  });

  describe('edge cases', () => {
    it('returns null for null array', () => {
      expect(findClosestFestival(null as any)).toBe(null);
    });

    it('returns null for empty array', () => {
      expect(findClosestFestival([])).toBe(null);
    });

    it('returns single festival when only one provided', () => {
      const festival = createFestival('1', '2024-06-01T00:00:00Z');
      expect(findClosestFestival([festival])).toBe(festival);
    });
  });

  describe('finding closest', () => {
    it('returns festival closest to today', () => {
      // Mock today to a fixed date
      const realDate = Date;
      const mockToday = new Date('2024-06-15T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(mockToday);

      const pastFestival = createFestival('past', '2024-06-01T00:00:00Z'); // 14 days before
      const closeFestival = createFestival('close', '2024-06-14T00:00:00Z'); // 1 day before
      const futureFestival = createFestival('future', '2024-06-20T00:00:00Z'); // 5 days after

      const result = findClosestFestival([pastFestival, closeFestival, futureFestival]);
      expect(result).toBe(closeFestival);

      vi.useRealTimers();
    });

    it('handles festivals all in the past', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-12-01T12:00:00Z'));

      const festival1 = createFestival('1', '2024-06-01T00:00:00Z');
      const festival2 = createFestival('2', '2024-08-01T00:00:00Z'); // Closer to Dec

      const result = findClosestFestival([festival1, festival2]);
      expect(result).toBe(festival2);

      vi.useRealTimers();
    });

    it('handles festivals all in the future', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      const festival1 = createFestival('1', '2024-06-01T00:00:00Z'); // Closer to Jan
      const festival2 = createFestival('2', '2024-12-01T00:00:00Z');

      const result = findClosestFestival([festival1, festival2]);
      expect(result).toBe(festival1);

      vi.useRealTimers();
    });
  });
});

describe('calculatePageForFestival', () => {
  const createFestivals = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `festival-${i + 1}`,
      title: `Festival ${i + 1}`,
    }));

  describe('edge cases', () => {
    it('returns 1 for null target', () => {
      const festivals = createFestivals(10);
      expect(calculatePageForFestival(festivals, null, 5)).toBe(1);
    });

    it('returns 1 for undefined target', () => {
      const festivals = createFestivals(10);
      expect(calculatePageForFestival(festivals, undefined, 5)).toBe(1);
    });

    it('returns 1 for empty festivals', () => {
      const target = { id: 'test' };
      expect(calculatePageForFestival([], target, 5)).toBe(1);
    });

    it('returns 1 when target not found', () => {
      const festivals = createFestivals(10);
      const target = { id: 'non-existent' };
      expect(calculatePageForFestival(festivals, target, 5)).toBe(1);
    });
  });

  describe('pagination', () => {
    it('returns page 1 for first item', () => {
      const festivals = createFestivals(20);
      expect(calculatePageForFestival(festivals, festivals[0], 5)).toBe(1);
    });

    it('returns page 1 for items 0-4 with 5 per page', () => {
      const festivals = createFestivals(20);
      expect(calculatePageForFestival(festivals, festivals[4], 5)).toBe(1);
    });

    it('returns page 2 for items 5-9 with 5 per page', () => {
      const festivals = createFestivals(20);
      expect(calculatePageForFestival(festivals, festivals[5], 5)).toBe(2);
      expect(calculatePageForFestival(festivals, festivals[9], 5)).toBe(2);
    });

    it('returns correct page for various positions', () => {
      const festivals = createFestivals(50);

      // With 10 per page
      expect(calculatePageForFestival(festivals, festivals[0], 10)).toBe(1);
      expect(calculatePageForFestival(festivals, festivals[10], 10)).toBe(2);
      expect(calculatePageForFestival(festivals, festivals[25], 10)).toBe(3);
      expect(calculatePageForFestival(festivals, festivals[49], 10)).toBe(5);
    });

    it('handles page size of 1', () => {
      const festivals = createFestivals(5);
      expect(calculatePageForFestival(festivals, festivals[0], 1)).toBe(1);
      expect(calculatePageForFestival(festivals, festivals[2], 1)).toBe(3);
      expect(calculatePageForFestival(festivals, festivals[4], 1)).toBe(5);
    });

    it('handles single festival', () => {
      const festivals = createFestivals(1);
      expect(calculatePageForFestival(festivals, festivals[0], 10)).toBe(1);
    });
  });
});
