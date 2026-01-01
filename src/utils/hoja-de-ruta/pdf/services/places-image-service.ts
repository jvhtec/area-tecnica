import { supabase } from '@/lib/supabase';

/**
 * Fetches location photos using Google Places API (New) v1
 */
export class PlacesImageService {
  private static apiKey: string | null = null;
  private static keyPromise: Promise<string | null> | null = null;
  private static photoCache: Map<string, string[]> = new Map();

  private static async ensureKey(): Promise<string | null> {
    if (this.apiKey) return this.apiKey;
    if (!this.keyPromise) {
      this.keyPromise = (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('get-google-maps-key');
          if (error) {
            console.error('Failed to fetch Google Maps API key:', error);
            return null;
          }
          const key = data?.apiKey || null;
          this.apiKey = key;
          return key;
        } catch (e) {
          console.error('Error fetching Google Maps API key:', e);
          return null;
        }
      })();
    }
    return this.keyPromise;
  }

  /**
   * Returns up to maxPhotos data URLs for the given query using Places Text Search and Photo media API.
   */
  static async getPhotosForQuery(query: string, maxPhotos: number = 2, maxWidthPx: number = 400, maxHeightPx: number = 300): Promise<string[]> {
    try {
      const cacheKey = `${query.trim().toLowerCase()}::${maxPhotos}::${maxWidthPx}x${maxHeightPx}`;
      const cached = this.photoCache.get(cacheKey);
      if (cached) return cached;
      // Prefer server-side function to avoid referrer/CORS/key restrictions
      try {
        const { data, error } = await supabase.functions.invoke('place-photos', {
          body: { query, maxPhotos, maxWidthPx, maxHeightPx },
        });
        if (!error && data?.photos) {
          this.photoCache.set(cacheKey, data.photos);
          return data.photos as string[];
        }
      } catch (e) {
        console.warn('place-photos function failed, attempting direct client fetch:', e);
      }

      // Fallback: direct client calls (requires admin/management access to key)
      const key = await this.ensureKey();
      if (!key) return [];
      // Reuse the previous client path if function wasn’t available
      const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.photos'
        },
        body: JSON.stringify({ textQuery: query, maxResultCount: 1 })
      });
      if (!searchRes.ok) return [];
      const searchData = await searchRes.json();
      const place = searchData?.places?.[0];
      const photos = place?.photos || [];
      if (!photos.length) {
        this.photoCache.set(cacheKey, []);
        return [];
      }
      const results: string[] = [];
      for (let i = 0; i < Math.min(maxPhotos, photos.length); i++) {
        const photoName = photos[i]?.name;
        if (!photoName) continue;
        try {
          const mediaUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&maxHeightPx=${maxHeightPx}`;
          const mediaRes = await fetch(mediaUrl, { headers: { 'X-Goog-Api-Key': key } });
          if (!mediaRes.ok) continue;
          const blob = await mediaRes.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read photo blob'));
            reader.readAsDataURL(blob);
          });
          results.push(dataUrl);
        } catch (_e) {}
      }
      this.photoCache.set(cacheKey, results);
      return results;
    } catch (e) {
      console.warn('getPhotosForQuery failed:', e);
      return [];
    }
  }
}
