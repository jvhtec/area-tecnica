import { supabase } from '@/lib/supabase-client';
import { Session } from '@supabase/supabase-js';

/**
 * Token Manager - Singleton class for managing auth tokens and refresh logic
 * - Handles automatic token refresh on expiry
 * - Manages subscription to token refresh events
 * - Coordinates token-related operations across the app
 * - Caches session data to reduce redundant calls
 */
export class TokenManager {
  private static instance: TokenManager;
  private subscribers: Array<() => void> = [];
  private isRefreshing = false;
  private refreshTimeout: number | null = null;
  private lastRefresh: number = Date.now();
  
  // Session caching properties
  private cachedSession: Session | null = null;
  private sessionCacheTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  private constructor() {
    // Set up auth state change listener
    supabase.auth.onAuthStateChange((event, session) => {
      console.log(`Auth state changed: ${event}`);
      
      // Update cached session whenever auth state changes
      this.updateCachedSession(session);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        this.lastRefresh = Date.now();
        this.notifySubscribers();
        this.scheduleNextRefresh(session);
      } else if (event === 'SIGNED_OUT') {
        if (this.refreshTimeout) {
          clearTimeout(this.refreshTimeout);
          this.refreshTimeout = null;
        }
      }
    });
    
    // Set up custom event listener for token refresh requests
    window.addEventListener('token-refresh-needed', () => {
      console.log('Token refresh requested');
      this.refreshToken();
    });
    
    // Setup visibility change listener to refresh token when tab becomes visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Get time since last refresh
        const timeSinceRefresh = Date.now() - this.lastRefresh;
        
        // If it's been more than 5 minutes since last refresh, refresh token
        if (timeSinceRefresh > 5 * 60 * 1000) {
          console.log('Tab became visible after inactivity, refreshing token');
          this.refreshToken();
        }
      }
    });
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }
  
  /**
   * Update the cached session and timestamp
   */
  private updateCachedSession(session: Session | null): void {
    this.cachedSession = session;
    this.sessionCacheTime = Date.now();
  }
  
  /**
   * Check if cached session is still valid
   */
  private isCacheValid(): boolean {
    const now = Date.now();
    const cacheAge = now - this.sessionCacheTime;
    return cacheAge < this.CACHE_DURATION;
  }
  
  /**
   * Get cached session if valid, otherwise fetch fresh session
   */
  public async getCachedSession(): Promise<Session | null> {
    // Return cached session if it's still valid
    if (this.cachedSession && this.isCacheValid()) {
      console.log('Returning cached session');
      return this.cachedSession;
    }
    
    // Cache is invalid or empty, fetch fresh session
    console.log('Fetching fresh session (cache miss or expired)');
    const { data } = await supabase.auth.getSession();
    this.updateCachedSession(data.session);
    return data.session;
  }
  
  /**
   * Refresh the token
   */
  public async refreshToken(): Promise<any> {
    if (this.isRefreshing) {
      console.log('Token refresh already in progress');
      return { session: null, error: false };
    }
    
    try {
      this.isRefreshing = true;
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing token:', error);
        return { session: null, error };
      }
      
      if (data.session) {
        this.lastRefresh = Date.now();
        this.updateCachedSession(data.session);
        this.notifySubscribers();
        this.scheduleNextRefresh(data.session);
        return { session: data.session, error: null };
      }
      
      return { session: null, error: null };
    } catch (error) {
      console.error('Exception during token refresh:', error);
      return { session: null, error };
    } finally {
      this.isRefreshing = false;
    }
  }
  
  /**
   * Get the current session, optionally refreshing it if needed
   */
  public async getSession(forceRefresh = false): Promise<any> {
    if (forceRefresh) {
      await this.refreshToken();
    }
    
    return this.getCachedSession();
  }

  /**
   * Sign the user out
   */
  public async signOut(): Promise<{ error: any }> {
    try {
      // Clear cached session
      this.updateCachedSession(null);
      
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      console.error('Error during sign out:', error);
      return { error };
    }
  }
  
  /**
   * Schedule the next token refresh based on expiry time
   */
  private scheduleNextRefresh(session: any): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
    
    if (!session) return;
    
    // If we have an expiry time, refresh 5 minutes before it expires
    if (session.expires_at) {
      const expiresAt = session.expires_at * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      
      // Refresh 5 minutes before expiry or immediately if already close to expiry
      const refreshIn = Math.max(timeUntilExpiry - (5 * 60 * 1000), 0);
      
      console.log(`Scheduling token refresh in ${refreshIn / 1000} seconds`);
      
      this.refreshTimeout = window.setTimeout(() => {
        console.log('Token expiry approaching, refreshing token');
        this.refreshToken();
      }, refreshIn);
    } else {
      // If no expiry time, refresh every 30 minutes
      this.refreshTimeout = window.setTimeout(() => {
        this.refreshToken();
      }, 30 * 60 * 1000);
    }
  }
  
  /**
   * Subscribe to token refresh events
   */
  public subscribe(callback: () => void): () => void {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }
  
  /**
   * Notify all subscribers of a token refresh
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in token refresh subscriber:', error);
      }
    });
  }
  
  /**
   * Get time since last token refresh
   */
  public getTimeSinceLastRefresh(): number {
    return Date.now() - this.lastRefresh;
  }

  /**
   * Calculate optimal refresh time based on session expiry
   * @param session Current authentication session
   * @returns Milliseconds until next refresh
   */
  public calculateRefreshTime(session: any): number {
    if (!session?.expires_at) {
      // Default refresh every 30 minutes if no expiry
      return 30 * 60 * 1000;
    }
    
    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    
    if (timeUntilExpiry <= 0) {
      // Already expired, refresh immediately
      return 0;
    }
    
    // Refresh 5 minutes before expiry or at 25% of remaining time, whichever is earlier
    const safetyBuffer = Math.min(5 * 60 * 1000, timeUntilExpiry * 0.25);
    return Math.max(timeUntilExpiry - safetyBuffer, 0);
  }

  /**
   * Check if token is close to expiration
   * @param session Current authentication session
   * @param thresholdMs Time in milliseconds that is considered "close to expiration"
   * @returns Boolean indicating if token is close to expiration
   */
  public checkTokenExpiration(session: any, thresholdMs: number = 5 * 60 * 1000): boolean {
    if (!session?.expires_at) {
      return false;
    }
    
    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    
    // Return true if we're within the threshold of expiration
    return timeUntilExpiry < thresholdMs;
  }
  
  /**
   * Force synchronization of session and subscriptions
   * Useful after long periods of inactivity
   */
  public async synchronizeState(): Promise<boolean> {
    // Refresh the token
    const { session } = await this.refreshToken();
    
    // Dispatch events to coordinate with other systems
    if (session) {
      window.dispatchEvent(new CustomEvent('supabase-reconnect'));
      window.dispatchEvent(new CustomEvent('connection-restored'));
      return true;
    }
    
    return false;
  }
  
  /**
   * Clear session cache (useful for testing or forced refresh)
   */
  public clearCache(): void {
    console.log('Clearing session cache');
    this.cachedSession = null;
    this.sessionCacheTime = 0;
  }
  
  /**
   * Get cache status for debugging
   */
  public getCacheStatus(): { hasCache: boolean; cacheAge: number; isValid: boolean } {
    const now = Date.now();
    const cacheAge = now - this.sessionCacheTime;
    return {
      hasCache: !!this.cachedSession,
      cacheAge,
      isValid: this.isCacheValid()
    };
  }
}
