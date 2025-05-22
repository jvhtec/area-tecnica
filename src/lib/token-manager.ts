
import { supabase } from './supabase';
import { Session, User, AuthError } from '@supabase/supabase-js';

type TokenManagerSubscriber = () => void;

export class TokenManager {
  private static instance: TokenManager;
  private _lastRefreshTime: number = 0;
  private refreshPromise: Promise<{ session: Session | null; error: AuthError | null }> | null = null;
  private refreshInterval: number = 3600000; // 1 hour in milliseconds
  private sessionExpiryBuffer: number = 300000; // 5 minutes in milliseconds
  private subscribers: TokenManagerSubscriber[] = [];

  private constructor() {
    // Initialize any token-related listeners or state here
    console.log('TokenManager initialized');
  }

  /**
   * Get the singleton instance of TokenManager
   */
  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }
  
  /**
   * Get the last refresh time
   */
  public get lastRefreshTime(): number {
    return this._lastRefreshTime;
  }

  /**
   * Subscribe to token refresh events
   * @param callback Function to call when token is refreshed
   * @returns Unsubscribe function
   */
  public subscribe(callback: TokenManagerSubscriber): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
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
        console.error('Error in token subscriber callback:', error);
      }
    });
  }

  /**
   * Get current session
   * @returns Current session or null
   */
  public async getSession(): Promise<Session | null> {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        return null;
      }
      
      return data.session;
    } catch (error) {
      console.error('Unexpected error in getSession:', error);
      return null;
    }
  }

  /**
   * Get time since last refresh in milliseconds
   * @returns Time in milliseconds
   */
  public getTimeSinceLastRefresh(): number {
    return Date.now() - this._lastRefreshTime;
  }

  /**
   * Check if the current session token is about to expire and refresh if needed
   * @param session Optional session object to check
   * @param bufferTime Optional custom buffer time in milliseconds
   * @returns True if token was refreshed or needs refreshing, false otherwise
   */
  public async checkTokenExpiration(session?: Session | null, bufferTime?: number): Promise<boolean> {
    try {
      // Use provided session or get current session
      const sessionToCheck = session || (await this.getSession());
      const bufferToUse = bufferTime || this.sessionExpiryBuffer;

      if (!sessionToCheck) {
        console.log('No active session found during token check');
        return false;
      }

      const expiresAt = sessionToCheck.expires_at;
      if (!expiresAt) {
        console.log('Session has no expiration time');
        return false;
      }

      const expiryTime = expiresAt * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiryTime - now;

      // If token expires within the buffer time, refresh it
      if (timeUntilExpiry < bufferToUse) {
        console.log(`Token expires in ${timeUntilExpiry}ms, refreshing...`);
        await this.refreshToken();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return false;
    }
  }

  /**
   * Calculate the optimal time until the next token refresh check
   * @param session Optional session to calculate from
   * @returns Time in milliseconds until next refresh
   */
  public calculateRefreshTime(session?: Session): number {
    // If no session provided, use standard interval
    if (!session || !session.expires_at) {
      return this.refreshInterval;
    }

    const expiryTime = session.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;

    // If expiry is sooner than our buffer, check very soon
    if (timeUntilExpiry < this.sessionExpiryBuffer) {
      return Math.max(5000, timeUntilExpiry - 60000); // Check 1 minute before expiry or in 5 seconds
    }

    // Otherwise check at a reasonable time before expiry
    return Math.min(
      this.refreshInterval,
      timeUntilExpiry - this.sessionExpiryBuffer
    );
  }

  /**
   * Refresh the authentication session
   * @returns The refreshed session or null if refresh failed
   */
  public async refreshToken(): Promise<{ session: Session | null; error: AuthError | null }> {
    // If there's already a refresh in progress, return that promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    console.log('Refreshing authentication session...');
    
    try {
      // Create a new refresh promise
      this.refreshPromise = new Promise(async (resolve) => {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          this._lastRefreshTime = Date.now();
          
          if (error) {
            console.error('Error refreshing session:', error);
            resolve({ session: null, error });
          } else {
            console.log('Session refreshed successfully');
            // Notify subscribers about successful refresh
            this.notifySubscribers();
            resolve({ session: data.session, error: null });
          }
        } catch (e) {
          console.error('Exception during session refresh:', e);
          resolve({ session: null, error: e as AuthError });
        } finally {
          // Clear the promise so we can refresh again later
          this.refreshPromise = null;
        }
      });
      
      return await this.refreshPromise;
    } catch (e) {
      console.error('Unexpected error in refreshSession:', e);
      this.refreshPromise = null;
      return { session: null, error: e as AuthError };
    }
  }
  
  /**
   * Sign out the current user and clear session data
   * @returns A promise that resolves when sign out is complete
   */
  public async signOut(): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (!error) {
        // Reset refresh time when signing out
        this._lastRefreshTime = 0;
        // Notify subscribers about sign out
        this.notifySubscribers();
      }
      
      return { error };
    } catch (e) {
      console.error('Error during sign out:', e);
      return { error: e as AuthError };
    }
  }
}

// Export a singleton instance
export const tokenManager = TokenManager.getInstance();
