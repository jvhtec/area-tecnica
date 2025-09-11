type CacheEntry = { url: string; expiresAt: number };

class LogoUrlCache {
  private static instance: LogoUrlCache;
  private cache = new Map<string, CacheEntry>();

  static getInstance(): LogoUrlCache {
    if (!this.instance) this.instance = new LogoUrlCache();
    return this.instance;
  }

  private key(bucket: string, path: string) {
    return `${bucket}:${path}`;
  }

  get(bucket: string, path: string): string | null {
    const entry = this.cache.get(this.key(bucket, path));
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(this.key(bucket, path));
      return null;
    }
    return entry.url;
  }

  set(bucket: string, path: string, url: string, ttlMs: number) {
    this.cache.set(this.key(bucket, path), { url, expiresAt: Date.now() + ttlMs });
  }
}

export const logoUrlCache = LogoUrlCache.getInstance();

