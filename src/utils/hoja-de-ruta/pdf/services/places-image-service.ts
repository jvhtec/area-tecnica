import { supabase } from '@/lib/supabase';

/**
 * Fetches location photos via the `place-photos` edge function.
 *
 * Photos come from Wikimedia (Wikipedia + Wikimedia Commons) — completely free,
 * no API key, no billing. Results are cached both in-memory here and
 * persistently in the edge function, so each venue is fetched at most once.
 */
export class PlacesImageService {
  private static photoCache: Map<string, string[]> = new Map();

  /**
   * Returns up to maxPhotos data URLs for the given query. Passing coordinates
   * (when known) improves the hit rate via Wikimedia Commons geosearch.
   */
  static async getPhotosForQuery(
    query: string,
    maxPhotos: number = 2,
    maxWidthPx: number = 500,
    maxHeightPx: number = 300,
    coordinates?: { lat: number; lng: number },
  ): Promise<string[]> {
    try {
      const locPart = coordinates ? `${coordinates.lat.toFixed(4)},${coordinates.lng.toFixed(4)}` : 'noloc';
      const cacheKey = `${query.trim().toLowerCase()}::${locPart}::${maxPhotos}::${maxWidthPx}x${maxHeightPx}`;
      const cached = this.photoCache.get(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase.functions.invoke('place-photos', {
        body: {
          query,
          maxPhotos,
          maxWidthPx,
          maxHeightPx,
          lat: coordinates?.lat,
          lng: coordinates?.lng,
        },
      });
      if (error) {
        console.warn('place-photos function failed:', error);
        return [];
      }
      const photos = (data?.photos as string[]) || [];
      this.photoCache.set(cacheKey, photos);
      return photos;
    } catch (e) {
      console.warn('getPhotosForQuery failed:', e);
      return [];
    }
  }
}
