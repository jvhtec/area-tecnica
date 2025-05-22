
import { supabase } from './supabase';
import { Session, AuthError } from '@supabase/supabase-js';

/**
 * TokenManager - Singleton responsible for managing auth tokens and refresh
 * Provides centralized token refresh mechanism to prevent multiple simultaneous refreshes
 */
export class TokenManager {
  private static instance: TokenManager;
  private lastRefreshTime: number = 0;
  private refreshPromise: Promise<{session: Session | null; error: AuthError | null}> | null = null;
  private subscribers: Set<() => void> = new Set();

  private constructor() {}

  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Get current session with token validation
   */
  public async getSession(): Promise<Session | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && this.isTokenExpired(session)) {
        console.log("Session token expired, refreshing...");
        return (await this.refreshToken()).session;
      }
      return session;
    } catch (error) {
      console.error("Error getting session:", error);
      return null;
    }
  }

  /**
   * Check if a token is expired
   * @param session The session to check
   * @param buffer Time buffer in ms (default: 60s)
   */
  public isTokenExpired(session: Session, buffer: number = 60000): boolean {
    if (!session.expires_at) return false;
    
    const expiresAt = session.expires_at * 1000; // Convert to ms
    const now = Date.now();
    
    return now >= expiresAt - buffer;
  }

  /**
   * Calculate optimal time to refresh token (75% of remaining time)
   * @param session Current session
   */
  public calculateRefreshTime(session: Session): number {
    if (!session.expires_at) return 3600 * 1000; // Default to 1 hour
    
    const expiresAt = session.expires_at * 1000; // Convert to ms
    const now = Date.now();
    const totalDuration = expiresAt - now;
    
    if (totalDuration <= 0) return 0; // Already expired
    
    // Refresh at 75% of the way through the session lifetime
    const refreshTime = totalDuration * 0.75;
    
    // Cap it between 5 minutes and 1 hour
    return Math.min(Math.max(refreshTime, 5 * 60 * 1000), 60 * 60 * 1000);
  }
  
  /**
   * Check if token will expire within the specified time
   */
  public checkTokenExpiration(session: Session, timeWindow: number): boolean {
    if (!session.expires_at) return false;
    
    const expiresAt = session.expires_at * 1000; // Convert to ms
    const now = Date.now();
    
    return now >= expiresAt - timeWindow;
  }

  /**
   * Refresh the auth token with debouncing
   * Returns the current refreshPromise if one is in progress
   */
  public async refreshToken(): Promise<{session: Session | null; error: AuthError | null}> {
    // If a refresh is already in progress, return the existing promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Start a new refresh
    console.log("Starting token refresh");
    this.refreshPromise = supabase.auth.refreshSession()
      .then(result => {
        this.lastRefreshTime = Date.now();
        
        // Notify subscribers of token refresh
        if (result.data.session) {
          this.notifySubscribers();
        }
        
        return result;
      })
      .catch(error => {
        console.error("Error refreshing token:", error);
        return { data: { session: null }, error };
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  /**
   * Sign out the user and clear tokens
   */
  public async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
      this.lastRefreshTime = 0;
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }
  
  /**
   * Get time since last refresh
   */
  public getTimeSinceLastRefresh(): number {
    return this.lastRefreshTime > 0 ? this.lastRefreshTime : Date.now();
  }

  /**
   * Subscribe to token refresh events
   * @param callback Function to call on token refresh
   * @returns Unsubscribe function
   */
  public subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers of token refresh
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error("Error in token refresh subscriber:", error);
      }
    });
  }
}
