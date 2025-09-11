import { supabase } from '@/lib/supabase';

interface LogoCacheEntry {
  url: string;
  timestamp: number;
  expiry: number;
}

interface BatchLogoRequest {
  tourId: string;
  resolve: (url: string | null) => void;
  reject: (error: Error) => void;
}

class LogoCacheService {
  private cache = new Map<string, LogoCacheEntry>();
  private pendingRequests = new Map<string, BatchLogoRequest[]>();
  private localStorage = typeof window !== 'undefined' ? window.localStorage : null;
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  private readonly BATCH_DELAY = 50; // 50ms batch delay

  constructor() {
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage() {
    if (!this.localStorage) return;
    
    try {
      const cached = this.localStorage.getItem('tour-logo-cache');
      if (cached) {
        const data = JSON.parse(cached);
        const now = Date.now();
        
        // Only load non-expired entries
        Object.entries(data).forEach(([key, value]) => {
          const entry = value as LogoCacheEntry;
          if (entry.expiry > now) {
            this.cache.set(key, entry);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to load logo cache from localStorage:', error);
    }
  }

  private saveToLocalStorage() {
    if (!this.localStorage) return;
    
    try {
      const cacheObject = Object.fromEntries(this.cache.entries());
      this.localStorage.setItem('tour-logo-cache', JSON.stringify(cacheObject));
    } catch (error) {
      console.warn('Failed to save logo cache to localStorage:', error);
    }
  }

  private isExpired(entry: LogoCacheEntry): boolean {
    return Date.now() > entry.expiry;
  }

  async getTourLogo(tourId: string): Promise<string | null> {
    // Check memory cache first
    const cached = this.cache.get(`tour-${tourId}`);
    if (cached && !this.isExpired(cached)) {
      return cached.url;
    }

    // Batch requests to avoid multiple concurrent calls for same logo
    return new Promise((resolve, reject) => {
      const key = `tour-${tourId}`;
      
      if (!this.pendingRequests.has(key)) {
        this.pendingRequests.set(key, []);
        
        // Batch multiple requests
        setTimeout(() => {
          this.fetchTourLogo(tourId);
        }, this.BATCH_DELAY);
      }
      
      this.pendingRequests.get(key)!.push({ tourId, resolve, reject });
    });
  }

  private async fetchTourLogo(tourId: string): Promise<void> {
    const key = `tour-${tourId}`;
    const requests = this.pendingRequests.get(key) || [];
    this.pendingRequests.delete(key);

    try {
      const { data, error } = await supabase
        .from('tour_logos')
        .select('file_path')
        .eq('tour_id', tourId)
        .maybeSingle();

      if (error) throw error;

      let logoUrl: string | null = null;

      if (data?.file_path) {
        try {
          // Try signed URL first
          const { data: signedUrlData } = await supabase.storage
            .from('tour-logos')
            .createSignedUrl(data.file_path, 60 * 60); // 1 hour expiry
            
          if (signedUrlData?.signedUrl) {
            logoUrl = signedUrlData.signedUrl;
          } else {
            // Fallback to public URL
            const { data: publicUrlData } = supabase.storage
              .from('tour-logos')
              .getPublicUrl(data.file_path);
              
            logoUrl = publicUrlData?.publicUrl || null;
          }
        } catch (storageError) {
          console.warn(`Storage error for tour ${tourId}:`, storageError);
          // Try public URL as final fallback
          const { data: publicUrlData } = supabase.storage
            .from('tour-logos')
            .getPublicUrl(data.file_path);
            
          logoUrl = publicUrlData?.publicUrl || null;
        }
      }

      // Cache the result
      if (logoUrl) {
        const cacheEntry: LogoCacheEntry = {
          url: logoUrl,
          timestamp: Date.now(),
          expiry: Date.now() + this.CACHE_DURATION
        };
        
        this.cache.set(key, cacheEntry);
        this.saveToLocalStorage();
      }

      // Resolve all pending requests
      requests.forEach(request => request.resolve(logoUrl));
    } catch (error) {
      console.error(`Error fetching tour logo for ${tourId}:`, error);
      requests.forEach(request => request.reject(error as Error));
    }
  }

  // Batch fetch multiple tour logos
  async batchGetTourLogos(tourIds: string[]): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();
    
    // Get all logos concurrently but with batching
    const promises = tourIds.map(async (tourId) => {
      try {
        const logoUrl = await this.getTourLogo(tourId);
        results.set(tourId, logoUrl);
      } catch (error) {
        console.warn(`Failed to get logo for tour ${tourId}:`, error);
        results.set(tourId, null);
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  clearCache() {
    this.cache.clear();
    if (this.localStorage) {
      this.localStorage.removeItem('tour-logo-cache');
    }
  }

  // Preload logos for tours
  preloadTourLogos(tourIds: string[]) {
    // Fire and forget - don't wait for results
    this.batchGetTourLogos(tourIds).catch(error => {
      console.warn('Error preloading tour logos:', error);
    });
  }
}

export const logoCache = new LogoCacheService();