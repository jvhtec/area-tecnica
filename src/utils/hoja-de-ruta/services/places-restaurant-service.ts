import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/types/hoja-de-ruta';
import { reportHojaError } from '@/features/hoja-de-ruta/lib/hojaLogger';

const GENERIC_PLACE_TYPES = ['establishment', 'point_of_interest', 'food', 'restaurant'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;

const finite = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const positive = (value: unknown): number | undefined => {
  const number = finite(value);
  return number ? number : undefined;
};

const stringList = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : undefined;

const latLng = (value: unknown): { lat: number; lng: number } | undefined => {
  if (!isRecord(value)) return undefined;
  const lat = finite(value.lat) ?? finite(value.latitude);
  const lng = finite(value.lng) ?? finite(value.longitude);
  return lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
};

const coordinatesOf = (raw: Record<string, unknown>) =>
  (isRecord(raw.geometry) ? latLng(raw.geometry.location) : undefined) ?? latLng(raw.location);

/**
 * Service for fetching restaurant data using Google Places API
 */
export class PlacesRestaurantService {
  private static restaurantCache: Map<string, Restaurant[]> = new Map();

  /**
   * Search for restaurants near a given venue address
   */
  static async searchRestaurantsNearVenue(
    venueAddress: string,
    radius: number = 2000,
    maxResults: number = 20,
    coordinates?: { lat: number; lng: number }
  ): Promise<Restaurant[]> {
    try {
      if (!coordinates && !venueAddress?.trim()) {
        return [];
      }

      const cacheKey = `${coordinates ? `${coordinates.lat},${coordinates.lng}` : venueAddress.trim().toLowerCase()}::${radius}::${maxResults}`;
      const cached = this.restaurantCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Preferred: server-side edge function (keeps API key private and works for technicians)
      try {
        const { data, error } = await supabase.functions.invoke('place-restaurants', {
          body: {
            location: venueAddress?.trim() || undefined,
            radius,
            maxResults,
            coordinates,
          },
        });
        const rows: unknown = data?.restaurants;
        if (!error && Array.isArray(rows)) {
          const restaurants = rows
            .map((row) => this.formatRestaurantData(row))
            .filter((restaurant): restaurant is Restaurant => restaurant !== null)
            .sort((left, right) => (left.distance || 0) - (right.distance || 0));

          this.restaurantCache.set(cacheKey, restaurants);
          return restaurants;
        } else if (error) {
          reportHojaError('restaurants.edge.search', error);
        }
      } catch (edgeErr) {
        reportHojaError('restaurants.edge.search', edgeErr);
      }

      // The edge function is the only path: it keeps the Google key server-side
      // and applies persistent caching. If it fails, return empty rather than
      // calling Google directly from the browser.
      return [];
    } catch (e) {
      reportHojaError('restaurants.nearVenue.search', e);
      return [];
    }
  }

  /**
   * Get detailed restaurant information by place ID
   */
  static async getRestaurantDetails(placeId: string): Promise<Restaurant | null> {
    try {
      const { data, error } = await supabase.functions.invoke('place-restaurants', {
        body: { details: true, placeId },
      });
      if (!error && data?.restaurant) {
        return this.formatRestaurantData(data.restaurant);
      }
      if (error) {
        reportHojaError('restaurants.details.fetch', error);
      }
      return null;
    } catch (e) {
      reportHojaError('restaurants.details.fetch', e);
      return null;
    }
  }

  /**
   * Calculate distance between venue and restaurant
   */
  static calculateDistance(
    venueCoords: { lat: number; lng: number },
    restaurantCoords: { lat: number; lng: number }
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(restaurantCoords.lat - venueCoords.lat);
    const dLon = this.deg2rad(restaurantCoords.lng - venueCoords.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(venueCoords.lat)) *
        Math.cos(this.deg2rad(restaurantCoords.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 1000); // Distance in meters
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Normalize a restaurant from the edge function, which may use either the
   * legacy Places fields (place_id, formatted_address, geometry) or the Places
   * API (New) fields (id, displayName, formattedAddress, location).
   */
  private static formatRestaurantData(rawData: unknown): Restaurant | null {
    if (!isRecord(rawData)) return null;
    const id = text(rawData.place_id) ?? text(rawData.id);
    if (!id) return null;

    const displayName = isRecord(rawData.displayName) ? text(rawData.displayName.text) : undefined;
    const types = Array.isArray(rawData.types)
      ? rawData.types.filter((type): type is string => typeof type === 'string')
      : undefined;
    const cuisine = types
      ? types.filter((type) => !GENERIC_PLACE_TYPES.includes(type))
      : stringList(rawData.cuisine) ?? [];

    return {
      id,
      name: text(rawData.name) ?? displayName ?? '',
      address: text(rawData.formatted_address) ?? text(rawData.formattedAddress) ?? '',
      rating: positive(rawData.rating),
      priceLevel: finite(rawData.price_level) ?? finite(rawData.priceLevel),
      photos: stringList(rawData.photos) ?? [],
      cuisine,
      phone: text(rawData.formatted_phone_number) ?? text(rawData.internationalPhoneNumber),
      website: text(rawData.website) ?? text(rawData.websiteUri),
      coordinates: coordinatesOf(rawData),
      distance: positive(rawData.distance),
      googlePlaceId: id,
      isSelected: false,
    };
  }

  /**
   * Clear the cache (useful when changing venues)
   */
  static clearCache(): void {
    this.restaurantCache.clear();
  }
}
