
/**
 * Utility functions for date operations
 */

import { formatMadridDateKey, fromMadridDateKey } from '@/utils/timezoneUtils';

export type FestivalDateCandidate = {
  id: string;
  start_time: string | number | Date;
};

/**
 * Find the festival closest to today's date
 * @param festivals Array of festival jobs
 * @returns The festival closest to today or null if no festivals
 */
export const findClosestFestival = <T extends FestivalDateCandidate>(
  festivals: T[] | null | undefined,
  reference: Date = new Date(),
): T | null => {
  if (!festivals || festivals.length === 0) return null;

  const today = fromMadridDateKey(formatMadridDateKey(reference)).getTime();

  let closestFestival = festivals[0];
  const initialFestivalDate = fromMadridDateKey(formatMadridDateKey(new Date(festivals[0].start_time))).getTime();
  let smallestDifference = Math.abs(initialFestivalDate - today);

  festivals.forEach(festival => {
    const festivalDate = fromMadridDateKey(formatMadridDateKey(new Date(festival.start_time))).getTime();
    const difference = Math.abs(festivalDate - today);
    
    if (difference < smallestDifference) {
      smallestDifference = difference;
      closestFestival = festival;
    }
  });

  return closestFestival;
};

/**
 * Calculate which page contains the target festival
 * @param festivals Array of all festivals
 * @param targetFestival The festival to find
 * @param itemsPerPage Number of items per page
 * @returns Page number (1-based) or 1 if not found
 */
export const calculatePageForFestival = <T extends { id: string }>(
  festivals: T[],
  targetFestival: T | null | undefined,
  itemsPerPage: number,
): number => {
  if (!targetFestival || !festivals.length) return 1;
  
  const index = festivals.findIndex(festival => festival.id === targetFestival.id);
  if (index === -1) return 1;
  
  return Math.floor(index / itemsPerPage) + 1;
};
