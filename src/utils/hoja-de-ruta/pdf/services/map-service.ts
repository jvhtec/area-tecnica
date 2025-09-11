import { supabase } from '@/lib/supabase';

export class MapService {
  private static geocodeCache: Map<string, { lat: number; lng: number }> = new Map();
  private static mapCache: Map<string, string> = new Map();
  private static googleApiKey: string | null = null;
  private static googleKeyPromise: Promise<string | null> | null = null;

  private static async ensureGoogleApiKey(): Promise<string | null> {
    if (this.googleApiKey) return this.googleApiKey;
    if (!this.googleKeyPromise) {
      this.googleKeyPromise = (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('get-secret', {
            body: { secretName: 'GOOGLE_MAPS_API_KEY' },
          });
          if (error) {
            console.error('Failed to fetch Google Maps API key:', error);
            return null;
          }
          const key = data?.GOOGLE_MAPS_API_KEY || null;
          this.googleApiKey = key;
          return key;
        } catch (e) {
          console.error('Error fetching Google Maps API key:', e);
          return null;
        }
      })();
    }
    return this.googleKeyPromise;
  }
  static async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const key = address.trim().toLowerCase();
      const cached = this.geocodeCache.get(key);
      if (cached) return cached;
      // Prefer Google Geocoding if key is available
      const apiKey = await this.ensureGoogleApiKey();
      if (apiKey) {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const result = data?.results?.[0]?.geometry?.location;
        if (result && typeof result.lat === 'number' && typeof result.lng === 'number') {
          const coords = { lat: result.lat, lng: result.lng };
          this.geocodeCache.set(key, coords);
          return coords;
        }
        return null;
      }
      // If no API key, do not geocode (Google-only provider requirement)
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
    const apiKey = await this.ensureGoogleApiKey();
    if (!apiKey) return null;
    // Use HiDPI + oversampling for crisper rendering in PDFs
    const scale = 2; // 2x density
    const w = Math.min(Math.max(Math.floor(width * 2), 1), 640);
    const h = Math.min(Math.max(Math.floor(height * 2), 1), 640);
    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${w}x${h}&scale=${scale}&format=png&maptype=roadmap&markers=size:tiny%7Ccolor:red%7C${lat},${lng}&key=${apiKey}`;
    const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}:${w}x${h}:google:${zoom}:s${scale}:os2`;
    const cached = this.mapCache.get(cacheKey);
    if (cached) return cached;
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
      console.warn('Google static map fetch failed:', e);
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

  /**
   * Unified helper: given an address, returns a static map data URL or null.
   * Uses caching, Nominatim geocode, and OSM static map provider.
   */
  static async getMapImageForAddress(
    address: string,
    width: number,
    height: number,
    zoom: number = 14
  ): Promise<string | null> {
    try {
      const apiKey = await this.ensureGoogleApiKey();
      if (!apiKey) return null;
      // HiDPI + oversampling for better quality
      const scale = 2;
      const w = Math.min(Math.max(Math.floor(width * 2), 1), 640);
      const h = Math.min(Math.max(Math.floor(height * 2), 1), 640);
      const cacheKey = `${address.trim().toLowerCase()}:${w}x${h}:google:${zoom}:s${scale}:os2`;
      const cached = this.mapCache.get(cacheKey);
      if (cached) return cached;
      const url = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=${zoom}&size=${w}x${h}&scale=${scale}&format=png&maptype=roadmap&markers=size:tiny%7Ccolor:red%7C${encodeURIComponent(address)}&key=${apiKey}`;
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
      console.warn('getMapImageForAddress failed:', e);
      return null;
    }
  }
}
