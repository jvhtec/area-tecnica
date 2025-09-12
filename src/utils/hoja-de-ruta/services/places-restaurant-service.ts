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
    maxResults: number = 20
  ): Promise<Restaurant[]> {
    try {
      const cacheKey = `${venueAddress.trim().toLowerCase()}::${radius}::${maxResults}`;
      const cached = this.restaurantCache.get(cacheKey);
      if (cached) return cached;

      // Use Supabase edge function for restaurant search
      const { data, error } = await supabase.functions.invoke('place-restaurants', {
        body: { 
          location: venueAddress, 
          radius,
          maxResults 
        },
      });

      if (!error && data?.restaurants) {
        const restaurants = data.restaurants.map(this.formatRestaurantData);
        this.restaurantCache.set(cacheKey, restaurants);
        return restaurants;
      }

      console.warn('Restaurant search function failed:', error);
      return [];
    } catch (e) {
      console.warn('searchRestaurantsNearVenue failed:', e);
      return [];
    }
  }

  /**
   * Get detailed restaurant information by place ID
   */
  static async getRestaurantDetails(placeId: string): Promise<Restaurant | null> {
    try {
      const { data, error } = await supabase.functions.invoke('place-restaurants', {
        body: { 
          placeId,
          details: true
        },
      });

      if (!error && data?.restaurant) {
        return this.formatRestaurantData(data.restaurant);
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
      priceLevel: rawData.price_level || rawData.priceLevel || undefined,
      photos: rawData.photos || [],
      cuisine: rawData.types?.filter((type: string) => 
        !['establishment', 'point_of_interest', 'food', 'restaurant'].includes(type)
      ) || rawData.cuisine || [],
      phone: rawData.formatted_phone_number || rawData.internationalPhoneNumber || undefined,
      website: rawData.website || rawData.websiteUri || undefined,
      coordinates: rawData.geometry?.location || rawData.location || undefined,
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