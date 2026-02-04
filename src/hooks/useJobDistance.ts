import { useMemo } from 'react';
import {
  calculateDistanceFromHomeBase,
  formatDistance,
  parseCoordinates,
} from '@/utils/distance';

interface LocationData {
  latitude?: string | number | null;
  longitude?: string | number | null;
}

interface JobWithLocation {
  locations?: LocationData | null;
  location?: LocationData | null;
}

/**
 * Hook to calculate and format distance from home base to job location
 *
 * @param job - Job object with location data
 * @returns Formatted distance string (e.g., "15 km") or null if location data is unavailable
 *
 * @example
 * const distance = useJobDistance(job);
 * // Returns: "15 km" or null
 */
export function useJobDistance(job: JobWithLocation | null | undefined): string | null {
  return useMemo(() => {
    if (!job) return null;

    // Try to get location from either 'locations' or 'location' field
    const locationData = job.locations || job.location;
    if (!locationData) return null;

    // Parse coordinates (handles both string and number types)
    const coordinates = parseCoordinates(
      locationData.latitude,
      locationData.longitude
    );

    if (!coordinates) return null;

    // Calculate distance from home base
    const distanceKm = calculateDistanceFromHomeBase(coordinates);
    if (distanceKm === null) return null;

    // Format for display
    return formatDistance(distanceKm);
  }, [job?.locations?.latitude, job?.locations?.longitude, job?.location?.latitude, job?.location?.longitude]);
}
