/**
 * Distance calculation utilities using Haversine formula
 * Provides consistent distance calculations across the application
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Home base coordinates (Madrid area)
 * Used as reference point for calculating distances to job locations
 */
export const HOME_BASE: Coordinates = {
  lat: 40.2282775,
  lng: -3.8418014,
};

/**
 * Convert degrees to radians
 */
function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 *
 * @param coord1 - First coordinate point
 * @param coord2 - Second coordinate point
 * @returns Distance in kilometers, or null if coordinates are invalid
 */
export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number | null {
  // Validate coordinates
  if (!coord1 || !coord2) return null;
  if (!Number.isFinite(coord1.lat) || !Number.isFinite(coord1.lng)) return null;
  if (!Number.isFinite(coord2.lat) || !Number.isFinite(coord2.lng)) return null;

  // Validate geographic coordinate ranges
  if (coord1.lat < -90 || coord1.lat > 90) return null;
  if (coord1.lng < -180 || coord1.lng > 180) return null;
  if (coord2.lat < -90 || coord2.lat > 90) return null;
  if (coord2.lng < -180 || coord2.lng > 180) return null;

  const R = 6371; // Earth's radius in kilometers
  const dLat = deg2rad(coord2.lat - coord1.lat);
  const dLng = deg2rad(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(coord1.lat)) *
      Math.cos(deg2rad(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Calculate distance from home base to a given coordinate
 *
 * @param coord - Target coordinate
 * @returns Distance in kilometers, or null if coordinate is invalid
 */
export function calculateDistanceFromHomeBase(coord: Coordinates): number | null {
  return calculateDistance(HOME_BASE, coord);
}

/**
 * Format distance for display
 *
 * @param distanceKm - Distance in kilometers
 * @returns Formatted distance string (e.g., "15 km", "< 1 km")
 */
export function formatDistance(distanceKm: number | null): string | null {
  if (distanceKm === null || !Number.isFinite(distanceKm)) {
    return null;
  }

  // For very short distances
  if (distanceKm < 1) {
    return "< 1 km";
  }

  // Round to whole number for readability
  const rounded = Math.round(distanceKm);

  // Format with thousands separator for large distances
  return `${rounded.toLocaleString('es-ES')} km`;
}

/**
 * Parse coordinates that might be stored as strings or numbers
 *
 * @param lat - Latitude (string or number)
 * @param lng - Longitude (string or number)
 * @returns Parsed coordinates or null if invalid
 */
export function parseCoordinates(
  lat: string | number | null | undefined,
  lng: string | number | null | undefined
): Coordinates | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return null;
  }

  const parsedLat = typeof lat === 'string' ? parseFloat(lat) : lat;
  const parsedLng = typeof lng === 'string' ? parseFloat(lng) : lng;

  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    return null;
  }

  // Validate geographic coordinate ranges
  if (parsedLat < -90 || parsedLat > 90) {
    return null;
  }
  if (parsedLng < -180 || parsedLng > 180) {
    return null;
  }

  return { lat: parsedLat, lng: parsedLng };
}
