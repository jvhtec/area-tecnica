import type { EventData } from '@/types/hoja-de-ruta';
import { normalizeVenueCoordinates } from '@/utils/hoja-de-ruta/venue-resolution';
import { buildStaticMapUrl, geocodeForward, getMapboxToken } from '@/lib/mapbox/mapboxClient';

export class MapService {
  private static geocodeCache: Map<string, { lat: number; lng: number }> = new Map();
  private static mapCache: Map<string, string> = new Map();

  static async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const key = address.trim().toLowerCase();
      const cached = this.geocodeCache.get(key);
      if (cached) return cached;

      const token = await getMapboxToken();
      if (!token) return null;

      const result = await geocodeForward(address, token);
      if (result) {
        const coords = { lat: result.lat, lng: result.lng };
        this.geocodeCache.set(key, coords);
        return coords;
      }
      return null;
    } catch (e) {
      console.warn('Geocoding failed for address:', address, e);
      return null;
    }
  }

  static async getStaticMapDataUrl(
    lat: number,
    lng: number,
    width: number = 640,
    height: number = 320,
    zoom: number = 14
  ): Promise<string | null> {
    // Oversample for crisper rendering in PDFs (Mapbox @2x retina tiles)
    const w = Math.min(Math.max(Math.floor(width * 2), 1), 1280);
    const h = Math.min(Math.max(Math.floor(height * 2), 1), 1280);
    const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}:${w}x${h}:mapbox:${zoom}`;
    const cached = this.mapCache.get(cacheKey);
    if (cached) return cached;

    const token = await getMapboxToken();
    if (!token) return null;
    const url = buildStaticMapUrl(token, { lat, lng, width: w, height: h, zoom });
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read map blob'));
        reader.readAsDataURL(blob);
      });
      this.mapCache.set(cacheKey, dataUrl);
      return dataUrl;
    } catch (e) {
      console.warn('Mapbox static map fetch failed:', e);
      return null;
    }
  }

  static generateRouteUrl(origin: string, destination: string): string {
    const baseUrl = "https://www.google.com/maps/dir/";
    const encodedOrigin = encodeURIComponent(origin);
    const encodedDestination = encodeURIComponent(destination);
    return `${baseUrl}${encodedOrigin}/${encodedDestination}`;
  }

  /**
   * Destination-only URL so devices can use current location as origin
   */
  static generateDestinationUrl(destination: string): string {
    const baseUrl = 'https://www.google.com/maps/dir/';
    const params = `?api=1&destination=${encodeURIComponent(destination)}`;
    return `${baseUrl}${params}`;
  }

  static generateVenueDestinationUrl(venue: EventData['venue']): string | null {
    const coordinates = normalizeVenueCoordinates(venue?.coordinates);
    if (coordinates) {
      return this.generateDestinationUrl(`${coordinates.lat},${coordinates.lng}`);
    }

    const address = venue?.address?.trim();
    return address ? this.generateDestinationUrl(address) : null;
  }

  static async getMapImageForVenue(
    venue: EventData['venue'],
    width: number,
    height: number,
    zoom: number = 14
  ): Promise<string | null> {
    const coordinates = normalizeVenueCoordinates(venue?.coordinates);
    if (coordinates) {
      return this.getStaticMapDataUrl(coordinates.lat, coordinates.lng, width, height, zoom);
    }

    const address = venue?.address?.trim();
    return address ? this.getMapImageForAddress(address, width, height, zoom) : null;
  }

  /**
   * Unified helper: given an address, returns a static map data URL or null.
   * Geocodes the address with Mapbox (cached) then renders a static map.
   */
  static async getMapImageForAddress(
    address: string,
    width: number,
    height: number,
    zoom: number = 14
  ): Promise<string | null> {
    try {
      const coords = await this.geocodeAddress(address);
      if (!coords) return null;
      return this.getStaticMapDataUrl(coords.lat, coords.lng, width, height, zoom);
    } catch (e) {
      console.warn('getMapImageForAddress failed:', e);
      return null;
    }
  }
}
