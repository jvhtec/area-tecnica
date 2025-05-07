
import { supabase } from "@/lib/supabase";

/**
 * TokenManager - Enhanced singleton class for JWT token management
 * Handles token refresh, expiration prediction, and session maintenance
 */
export class TokenManager {
  private static instance: TokenManager;
  private refreshPromise: Promise<any> | null = null;
  private lastRefreshTime: number = 0;
  private refreshQueue: Array<{
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = [];
  private tokenExpiryTimes: Map<string, number> = new Map();
  private refreshInProgress: boolean = false;
  private refreshBackoff: number = 1000; // Start with 1s backoff
  private maxBackoff: number = 30000; // Max 30s backoff
  private consecutiveFailures: number = 0;
  private listeners: Set<() => void> = new Set();

  private constructor() {}

  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Subscribe to token refresh events
   * @param callback Function to be called when token is refreshed
   * @returns Function to unsubscribe
   */
  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error("Error in token refresh listener:", error);
      }
    });
  }

  /**
   * Refresh the session token with intelligent queueing and backoff
   */
  public async refreshToken(): Promise<{session: any | null, error: any | null}> {
    // If there's a refresh already in progress, queue this request
    if (this.refreshInProgress) {
      console.log("Token refresh already in progress, queueing request");
      return new Promise((resolve, reject) => {
        this.refreshQueue.push({ resolve, reject });
      });
    }

    // Apply backoff if we've had consecutive failures
    if (this.consecutiveFailures > 0) {
      const backoffTime = Math.min(
        this.refreshBackoff * Math.pow(2, this.consecutiveFailures - 1),
        this.maxBackoff
      );
      console.log(`Applying backoff of ${backoffTime}ms after ${this.consecutiveFailures} failures`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }

    // Set refresh in progress
    this.refreshInProgress = true;

    // Create a new refresh promise
    this.refreshPromise = new Promise(async (resolve) => {
      try {
        console.log("Starting token refresh");
        const { data, error } = await supabase.auth.refreshSession();
        
        if (error) {
          console.error("Error refreshing token:", error);
          this.consecutiveFailures++;
          resolve({ session: null, error });
        } else {
          console.log("Token refreshed successfully");
          this.lastRefreshTime = Date.now();
          this.consecutiveFailures = 0;
          
          // Store the expiry time for prediction
          if (data.session?.expires_at) {
            this.tokenExpiryTimes.set(
              data.session.access_token,
              data.session.expires_at * 1000
            );
          }
          
          // Notify listeners of successful refresh
          this.notifyListeners();
          
          resolve({ session: data.session, error: null });
        }
      } catch (error) {
        console.error("Exception in token refresh:", error);
        this.consecutiveFailures++;
        resolve({ session: null, error });
      } finally {
        // Clear refresh state
        this.refreshInProgress = false;
        this.refreshPromise = null;
        
        // Process any queued refreshes
        if (this.refreshQueue.length > 0) {
          console.log(`Processing ${this.refreshQueue.length} queued token refresh requests`);
          const { session, error } = await this.refreshToken();
          
          // Resolve all queued promises with the same result
          while (this.refreshQueue.length > 0) {
            const request = this.refreshQueue.shift();
            if (request) {
              if (error) {
                request.reject(error);
              } else {
                request.resolve({ session, error: null });
              }
            }
          }
        }
      }
    });

    return this.refreshPromise;
  }

  /**
   * Check if the token is about to expire with predictive timing
   * @param session Current session
   * @param bufferTime Time in ms before expiry to consider token expired (default: 5 min)
   */
  public async checkTokenExpiration(
    session: any,
    bufferTime: number = 5 * 60 * 1000
  ): Promise<boolean> {
    if (!session) return false;
    
    // Get expiry time from token storage or session
    let expiresAt = this.tokenExpiryTimes.get(session.access_token);
    
    // Fallback to session expires_at if not in our map
    if (!expiresAt && session.expires_at) {
      expiresAt = session.expires_at * 1000;
      
      // Store for future reference
      this.tokenExpiryTimes.set(session.access_token, expiresAt);
    }
    
    // If we still don't have an expiry time, use a conservative estimate
    if (!expiresAt) {
      // JWT tokens typically last 1 hour, so assume that if we haven't
      // refreshed in 55 minutes, we need to refresh
      return (Date.now() - this.lastRefreshTime) > (55 * 60 * 1000);
    }
    
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    
    // If token expires in less than the buffer time, consider it expired
    return timeUntilExpiry < bufferTime;
  }

  /**
   * Get the current session with optional auto-refresh
   * @param autoRefresh Whether to automatically refresh if session is expired
   */
  public async getSession(autoRefresh: boolean = true): Promise<any> {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      
      // If session exists but is about to expire, refresh it
      if (autoRefresh && session && await this.checkTokenExpiration(session)) {
        console.log("Session is about to expire, refreshing token");
        const { session: refreshedSession } = await this.refreshToken();
        return refreshedSession;
      }
      
      return session;
    } catch (error) {
      console.error("Error getting session:", error);
      return null;
    }
  }

  /**
   * Get the time until the token expires
   * @param session Current session
   * @returns Time in ms until token expires, or null if unknown
   */
  public getTimeUntilExpiry(session: any): number | null {
    if (!session) return null;
    
    // Try to get expiry from our map first
    let expiresAt = this.tokenExpiryTimes.get(session.access_token);
    
    // Fallback to session expires_at
    if (!expiresAt && session.expires_at) {
      expiresAt = session.expires_at * 1000;
    }
    
    if (!expiresAt) return null;
    
    return Math.max(0, expiresAt - Date.now());
  }

  /**
   * Calculate the optimal time to refresh the token
   * @param session Current session
   * @returns Time in ms to wait before refreshing
   */
  public calculateRefreshTime(session: any): number {
    const timeUntilExpiry = this.getTimeUntilExpiry(session);
    
    if (!timeUntilExpiry) {
      // If we can't determine expiry time, use a conservative default
      return 15 * 60 * 1000; // 15 minutes
    }
    
    // Refresh when 20% of time remains, but at least 1 minute before expiry
    // and no more than 15 minutes before expiry
    return Math.min(
      Math.max(timeUntilExpiry * 0.2, 60 * 1000),
      15 * 60 * 1000
    );
  }

  /**
   * Sign out and clear session
   */
  public async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
      this.tokenExpiryTimes.clear();
      this.lastRefreshTime = 0;
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }
}
