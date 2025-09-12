import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/types/hoja-de-ruta';

/**
 * Service for fetching restaurant data using Google Places API
 */
export class PlacesRestaurantService {
  private static restaurantCache: Map<string, Restaurant[]> = new Map();
  private static apiKey: string | null = null;

  private static async ensureApiKey(): Promise<string | null> {
    if (this.apiKey) return this.apiKey;
    try {
      const { data, error } = await supabase.functions.invoke('get-secret', {
        body: { secretName: 'GOOGLE_MAPS_API_KEY' },
      });
      if (error) {
        console.error('Failed to fetch Google Maps API key:', error);
        return null;
      }
      if (data?.GOOGLE_MAPS_API_KEY) {
        this.apiKey = data.GOOGLE_MAPS_API_KEY as string;
        return this.apiKey;
      }
    } catch (err) {
      console.error('Error fetching Google Maps API key:', err);
    }
    return null;
  }

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

      // FRONTEND IMPLEMENTATION USING GOOGLE PLACES API (browser)
      const apiKey = await this.ensureApiKey();
      if (!apiKey) {
        console.warn('No Google API key available');
        return [];
      }

      // Determine coordinates (use provided, else geocode the address)
      let lat: number | undefined = coordinates?.lat;
      let lng: number | undefined = coordinates?.lng;

      if ((!lat || !lng) && venueAddress?.trim()) {
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(venueAddress.trim())}&key=${apiKey}`;
        const geocodeRes = await fetch(geocodeUrl);
        if (!geocodeRes.ok) {
          console.error('Geocode HTTP error:', geocodeRes.status);
          return [];
        }
        const geocodeData = await geocodeRes.json();
        if (geocodeData?.results?.length > 0) {
          lat = geocodeData.results[0].geometry.location.lat;
          lng = geocodeData.results[0].geometry.location.lng;
        } else {
          console.warn('Geocode returned no results');
          return [];
        }
      }

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        console.warn('Missing coordinates after geocoding');
        return [];
      }

      // Nearby search via Places API v1
      const searchUrl = 'https://places.googleapis.com/v1/places:searchNearby';
      const searchRes = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.types,places.internationalPhoneNumber,places.websiteUri,places.location,places.photos'
        },
        body: JSON.stringify({
          includedPrimaryTypes: ['restaurant'],
          maxResultCount: Math.min(maxResults, 20),
          rankPreference: 'DISTANCE',
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: radius
            }
          },
          languageCode: 'es',
          regionCode: 'ES'
        })
      });

      if (!searchRes.ok) {
        const txt = await searchRes.text().catch(() => '');
        console.error('Places search API error:', searchRes.status, txt);
        return [];
      }

      const data = await searchRes.json();
      const places = data?.places || [];

      const restaurants = places.map((place: any) => {
        const distance = this.calculateDistance(
          { lat, lng },
          { lat: place.location.latitude, lng: place.location.longitude }
        );

        let photos: string[] = [];
        if (place.photos && place.photos.length > 0) {
          photos = place.photos.slice(0, 3).map((photo: any) => photo.name);
        }

        return this.formatRestaurantData({
          id: place.id,
          displayName: place.displayName,
          formattedAddress: place.formattedAddress,
          rating: place.rating,
          priceLevel: this.mapPriceLevel(place.priceLevel),
          types: place.types,
          internationalPhoneNumber: place.internationalPhoneNumber,
          websiteUri: place.websiteUri,
          location: { latitude: place.location.latitude, longitude: place.location.longitude },
          photos,
          distance,
        });
      });

      restaurants.sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0));
      this.restaurantCache.set(cacheKey, restaurants);
      return restaurants;
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
      const apiKey = await this.ensureApiKey();
      if (!apiKey) return null;

      const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,priceLevel,types,internationalPhoneNumber,websiteUri,location,photos'
        }
      });

      if (!res.ok) {
        console.error('Place details API error:', res.status, await res.text().catch(() => ''));
        return null;
      }

      const data = await res.json();
      return this.formatRestaurantData(data);
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

  private static mapPriceLevel(priceLevel?: string): number | undefined {
    if (!priceLevel) return undefined;
    const map: Record<string, number> = {
      PRICE_LEVEL_FREE: 0,
      PRICE_LEVEL_INEXPENSIVE: 1,
      PRICE_LEVEL_MODERATE: 2,
      PRICE_LEVEL_EXPENSIVE: 3,
      PRICE_LEVEL_VERY_EXPENSIVE: 4
    };
    return map[priceLevel] ?? undefined;
  }

  /**
   * Clear the cache (useful when changing venues)
   */
  static clearCache(): void {
    this.restaurantCache.clear();
  }
}
