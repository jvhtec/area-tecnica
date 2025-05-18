
import { supabase } from '@/lib/supabase-client';

/**
 * Token Manager - Singleton class for managing auth tokens and refresh logic
 * - Handles automatic token refresh on expiry
 * - Manages subscription to token refresh events
 * - Coordinates token-related operations across the app
 */
export class TokenManager {
  private static instance: TokenManager;
  private subscribers: Array<() => void> = [];
  private isRefreshing = false;
  private refreshTimeout: number | null = null;
  private lastRefresh: number = Date.now();
  
  private constructor() {
    // Set up auth state change listener
    supabase.auth.onAuthStateChange((event, session) => {
      console.log(`Auth state changed: ${event}`);
      
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
   * Refresh the token
   */
  public async refreshToken(): Promise<boolean> {
    if (this.isRefreshing) {
      console.log('Token refresh already in progress');
      return false;
    }
    
    try {
      this.isRefreshing = true;
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing token:', error);
        return false;
      }
      
      if (data.session) {
        this.lastRefresh = Date.now();
        this.notifySubscribers();
        this.scheduleNextRefresh(data.session);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Exception during token refresh:', error);
      return false;
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
    
    const { data } = await supabase.auth.getSession();
    return data.session;
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
   * Force synchronization of session and subscriptions
   * Useful after long periods of inactivity
   */
  public async synchronizeState(): Promise<boolean> {
    // Refresh the token
    const tokenRefreshed = await this.refreshToken();
    
    // Dispatch events to coordinate with other systems
    if (tokenRefreshed) {
      window.dispatchEvent(new CustomEvent('supabase-reconnect'));
      window.dispatchEvent(new CustomEvent('connection-restored'));
    }
    
    return tokenRefreshed;
  }
}
