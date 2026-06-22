import { supabase } from '@/lib/supabase';

/**
 * Fetches location photos via the `place-photos` edge function.
 *
 * Photos remain on Google Places (Mapbox has no photo API), but the Google key
 * stays server-side and results are cached both in-memory here and persistently
 * in the edge function, so each venue is fetched at most once.
 */
export class PlacesImageService {
  private static photoCache: Map<string, string[]> = new Map();

  /**
   * Returns up to maxPhotos data URLs for the given query.
   */
  static async getPhotosForQuery(query: string, maxPhotos: number = 2, maxWidthPx: number = 400, maxHeightPx: number = 300): Promise<string[]> {
    try {
      const cacheKey = `${query.trim().toLowerCase()}::${maxPhotos}::${maxWidthPx}x${maxHeightPx}`;
      const cached = this.photoCache.get(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase.functions.invoke('place-photos', {
        body: { query, maxPhotos, maxWidthPx, maxHeightPx },
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
