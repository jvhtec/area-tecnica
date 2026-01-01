/**
 * Rate limiter for Google Places API calls to stay within free tier limits
 *
 * Free tier limits (approximate):
 * - Place Details: 100,000/month free
 * - Text Search: Not free, $0.032/request
 * - Autocomplete: Not free, $0.00283/request
 * - Photos: $0.007/photo
 *
 * Strategy:
 * - Aggressive caching with localStorage
 * - Rate limiting per endpoint
 * - Debouncing user inputs
 */

interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
}

interface RequestRecord {
  timestamp: number;
  endpoint: string;
}

const STORAGE_KEY = 'google_places_api_usage';
const CACHE_STORAGE_KEY = 'google_places_api_cache';

// Conservative limits to stay well within free tier
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'place-details': {
    maxRequestsPerMinute: 10,
    maxRequestsPerHour: 200,
    maxRequestsPerDay: 3000, // ~100k/month = ~3,300/day
  },
  'text-search': {
    maxRequestsPerMinute: 5,
    maxRequestsPerHour: 50,
    maxRequestsPerDay: 500, // Minimize paid requests
  },
  'autocomplete': {
    maxRequestsPerMinute: 10,
    maxRequestsPerHour: 100,
    maxRequestsPerDay: 1000, // Minimize paid requests
  },
  'photo': {
    maxRequestsPerMinute: 5,
    maxRequestsPerHour: 50,
    maxRequestsPerDay: 500,
  },
  'nearby-search': {
    maxRequestsPerMinute: 5,
    maxRequestsPerHour: 50,
    maxRequestsPerDay: 500,
  }
};

class RateLimiter {
  private static instance: RateLimiter;
  private requestHistory: RequestRecord[] = [];

  private constructor() {
    this.loadHistory();
    // Clean up old records every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.requestHistory = JSON.parse(stored);
        // Remove records older than 24 hours
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        this.requestHistory = this.requestHistory.filter(r => r.timestamp > oneDayAgo);
      }
    } catch (e) {
      console.warn('Failed to load rate limiter history:', e);
      this.requestHistory = [];
    }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.requestHistory));
    } catch (e) {
      console.warn('Failed to save rate limiter history:', e);
    }
  }

  private cleanup(): void {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.requestHistory = this.requestHistory.filter(r => r.timestamp > oneDayAgo);
    this.saveHistory();
  }

  private getRequestCount(endpoint: string, timeWindowMs: number): number {
    const cutoff = Date.now() - timeWindowMs;
    return this.requestHistory.filter(
      r => r.endpoint === endpoint && r.timestamp > cutoff
    ).length;
  }

  canMakeRequest(endpoint: string): boolean {
    const limits = RATE_LIMITS[endpoint];
    if (!limits) {
      console.warn(`No rate limit configured for endpoint: ${endpoint}`);
      return true;
    }

    const perMinute = this.getRequestCount(endpoint, 60 * 1000);
    const perHour = this.getRequestCount(endpoint, 60 * 60 * 1000);
    const perDay = this.getRequestCount(endpoint, 24 * 60 * 60 * 1000);

    if (perMinute >= limits.maxRequestsPerMinute) {
      console.warn(`Rate limit exceeded for ${endpoint}: ${perMinute} requests/minute`);
      return false;
    }

    if (perHour >= limits.maxRequestsPerHour) {
      console.warn(`Rate limit exceeded for ${endpoint}: ${perHour} requests/hour`);
      return false;
    }

    if (perDay >= limits.maxRequestsPerDay) {
      console.warn(`Rate limit exceeded for ${endpoint}: ${perDay} requests/day`);
      return false;
    }

    return true;
  }

  recordRequest(endpoint: string): void {
    this.requestHistory.push({
      timestamp: Date.now(),
      endpoint
    });
    this.saveHistory();
  }

  getUsageStats(): Record<string, { perMinute: number; perHour: number; perDay: number }> {
    const stats: Record<string, { perMinute: number; perHour: number; perDay: number }> = {};

    for (const endpoint of Object.keys(RATE_LIMITS)) {
      stats[endpoint] = {
        perMinute: this.getRequestCount(endpoint, 60 * 1000),
        perHour: this.getRequestCount(endpoint, 60 * 60 * 1000),
        perDay: this.getRequestCount(endpoint, 24 * 60 * 60 * 1000)
      };
    }

    return stats;
  }
}

// Persistent cache for API responses
class ApiCache {
  private static readonly CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  static get(key: string): any | null {
    try {
      const stored = localStorage.getItem(`${CACHE_STORAGE_KEY}:${key}`);
      if (!stored) return null;

      const { data, timestamp } = JSON.parse(stored);
      if (Date.now() - timestamp > this.CACHE_DURATION_MS) {
        localStorage.removeItem(`${CACHE_STORAGE_KEY}:${key}`);
        return null;
      }

      return data;
    } catch (e) {
      return null;
    }
  }

  static set(key: string, data: any): void {
    try {
      localStorage.setItem(`${CACHE_STORAGE_KEY}:${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Failed to cache API response:', e);
    }
  }

  static clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(CACHE_STORAGE_KEY)) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Failed to clear API cache:', e);
    }
  }
}

export const rateLimiter = RateLimiter.getInstance();
export const apiCache = ApiCache;
