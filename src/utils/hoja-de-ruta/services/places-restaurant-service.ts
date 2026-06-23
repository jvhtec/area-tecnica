import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/types/hoja-de-ruta';

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
      console.log('SearchRestaurantsNearVenue called with:', { venueAddress, radius, maxResults });
      
      if (!coordinates && !venueAddress?.trim()) {
        console.warn('No venue coordinates or address provided');
        return [];
      }

      const cacheKey = `${coordinates ? `${coordinates.lat},${coordinates.lng}` : venueAddress.trim().toLowerCase()}::${radius}::${maxResults}`;
      const cached = this.restaurantCache.get(cacheKey);
      if (cached) {
        console.log('Returning cached results for:', cacheKey);
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
        if (!error && data?.restaurants) {
          const restaurants: Restaurant[] = (data.restaurants as any[]).map((r: any) => this.formatRestaurantData({
            id: r.id || r.place_id,
            name: r.name || r.displayName?.text,
            displayName: r.displayName,
            formattedAddress: r.formatted_address || r.formattedAddress,
            rating: r.rating,
            price_level: r.price_level,
            priceLevel: r.priceLevel,
            types: r.types,
            formatted_phone_number: r.formatted_phone_number,
            internationalPhoneNumber: r.internationalPhoneNumber,
            website: r.website || r.websiteUri,
            websiteUri: r.websiteUri,
            geometry: r.geometry,
            location: r.location || (r.geometry?.location ? { latitude: r.geometry.location.lat, longitude: r.geometry.location.lng } : undefined),
            photos: r.photos,
            distance: r.distance,
          }));

          restaurants.sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0));
          this.restaurantCache.set(cacheKey, restaurants);
          return restaurants;
        } else if (error) {
          console.warn('place-restaurants edge call failed:', error);
        }
      } catch (edgeErr) {
        console.warn('place-restaurants edge call threw:', edgeErr);
      }

      // The edge function is the only path: it keeps the Google key server-side
      // and applies persistent caching. If it fails, return empty rather than
      // calling Google directly from the browser.
      return [];
    } catch (e) {
      console.error('searchRestaurantsNearVenue failed:', e);
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
        console.warn('place-restaurants details failed:', error);
      }
      return null;
    } catch (e) {
      console.warn('getRestaurantDetails failed:', e);
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
   * Format raw Google Places API data to Restaurant interface
   */
  private static formatRestaurantData(rawData: any): Restaurant {
    return {
      id: rawData.place_id || rawData.id,
      name: rawData.name || rawData.displayName?.text || '',
      address: rawData.formatted_address || rawData.formattedAddress || '',
      rating: rawData.rating || undefined,
      priceLevel: rawData.price_level ?? rawData.priceLevel ?? undefined,
      photos: rawData.photos || [],
      cuisine: rawData.types?.filter((type: string) => 
        !['establishment', 'point_of_interest', 'food', 'restaurant'].includes(type)
      ) || rawData.cuisine || [],
      phone: rawData.formatted_phone_number || rawData.internationalPhoneNumber || undefined,
      website: rawData.website || rawData.websiteUri || undefined,
      coordinates: rawData.geometry?.location || (rawData.location ? { lat: rawData.location.latitude, lng: rawData.location.longitude } : undefined) || rawData.location || undefined,
      distance: rawData.distance || undefined,
      googlePlaceId: rawData.place_id || rawData.id,
      isSelected: false
    };
  }

  /**
   * Clear the cache (useful when changing venues)
   */
  static clearCache(): void {
    this.restaurantCache.clear();
  }
}
