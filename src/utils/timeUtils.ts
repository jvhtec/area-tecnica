
import { format } from "date-fns";

export interface TimeComparison {
  date: string;
  time: string;
  isAfterMidnight?: boolean;
}

/**
 * Compares two times chronologically, handling day transitions correctly
 * Times after midnight (00:00-06:59) are considered part of the next day
 */
export const compareChronologically = (a: TimeComparison, b: TimeComparison): number => {
  // First sort by date
  if (a.date !== b.date) {
    return a.date.localeCompare(b.date);
  }

  // Then sort by time within the same date
  if (!a.time && !b.time) return 0;
  if (!a.time) return 1;
  if (!b.time) return -1;

  const [aHours, aMinutes] = a.time.split(':').map(Number);
  const [bHours, bMinutes] = b.time.split(':').map(Number);

  // Convert to comparable values (times after midnight get 24+ hours)
  const aValue = (aHours < 7 ? aHours + 24 : aHours) * 60 + aMinutes;
  const bValue = (bHours < 7 ? bHours + 24 : bHours) * 60 + bMinutes;

  return aValue - bValue;
};

/**
 * Sorts an array of items chronologically based on date and time
 */
export const sortChronologically = <T extends { date: string; time?: string; isaftermidnight?: boolean }>(
  items: T[]
): T[] => {
  return [...items].sort((a, b) => 
    compareChronologically(
      { date: a.date, time: a.time || '', isAfterMidnight: a.isaftermidnight },
      { date: b.date, time: b.time || '', isAfterMidnight: b.isaftermidnight }
    )
  );
};

/**
 * Groups items by date while maintaining chronological order
 */
export const groupByDateChronologically = <T extends { date: string; time?: string }>(
  items: T[]
): Record<string, T[]> => {
  const sorted = sortChronologically(items);
  const grouped: Record<string, T[]> = {};
  
  sorted.forEach(item => {
    if (!grouped[item.date]) {
      grouped[item.date] = [];
    }
    grouped[item.date].push(item);
  });
  
  return grouped;
};
