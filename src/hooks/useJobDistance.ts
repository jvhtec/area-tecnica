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
  locations?: LocationData | LocationData[] | null;
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
    let locationData: LocationData | null = null;

    if (job.locations) {
      // Handle array of locations (pick first non-null element)
      if (Array.isArray(job.locations)) {
        locationData = job.locations.find(loc => loc && (loc.latitude || loc.longitude)) || null;
      } else {
        locationData = job.locations;
      }
    }

    // Fall back to job.location if locations is absent/empty
    if (!locationData && job.location) {
      locationData = job.location;
    }

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
  }, [
    // Handle both array and object locations
    Array.isArray(job?.locations) ? job?.locations?.[0]?.latitude : job?.locations?.latitude,
    Array.isArray(job?.locations) ? job?.locations?.[0]?.longitude : job?.locations?.longitude,
    Array.isArray(job?.locations) ? job?.locations?.length : undefined,
    job?.location?.latitude,
    job?.location?.longitude
  ]);
}
