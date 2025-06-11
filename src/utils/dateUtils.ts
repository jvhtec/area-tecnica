
/**
 * Utility functions for date operations
 */

/**
 * Find the festival closest to today's date
 * @param festivals Array of festival jobs
 * @returns The festival closest to today or null if no festivals
 */
export const findClosestFestival = (festivals: any[]) => {
  if (!festivals || festivals.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison

  let closestFestival = festivals[0];
  let smallestDifference = Math.abs(new Date(festivals[0].start_time).getTime() - today.getTime());

  festivals.forEach(festival => {
    const festivalDate = new Date(festival.start_time);
    festivalDate.setHours(0, 0, 0, 0);
    const difference = Math.abs(festivalDate.getTime() - today.getTime());
    
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
export const calculatePageForFestival = (festivals: any[], targetFestival: any, itemsPerPage: number) => {
  if (!targetFestival || !festivals.length) return 1;
  
  const index = festivals.findIndex(festival => festival.id === targetFestival.id);
  if (index === -1) return 1;
  
  return Math.floor(index / itemsPerPage) + 1;
};
