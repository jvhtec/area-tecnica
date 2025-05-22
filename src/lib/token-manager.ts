import { supabase } from './supabase';
import { Session, User, AuthError } from '@supabase/supabase-js';

class TokenManager {
  private static instance: TokenManager;
  private refreshPromise: Promise<{ session: Session | null; error: AuthError | null }> | null = null;
  private lastRefreshTime: number = 0;
  private refreshInterval: number = 3600000; // 1 hour in milliseconds
  private sessionExpiryBuffer: number = 300000; // 5 minutes in milliseconds

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
   * Check if the current session token is about to expire and refresh if needed
   * @returns True if token was refreshed, false otherwise
   */
  public async checkTokenExpiration(): Promise<boolean> {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
      console.log('No active session found during token check');
      return false;
    }

    const expiresAt = session.expires_at;
    if (!expiresAt) {
      console.log('Session has no expiration time');
      return false;
    }

    const expiryTime = expiresAt * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;

    // If token expires within the buffer time, refresh it
    if (timeUntilExpiry < this.sessionExpiryBuffer) {
      console.log(`Token expires in ${timeUntilExpiry}ms, refreshing...`);
      await this.refreshSession();
      return true;
    }

    return false;
  }

  /**
   * Calculate the optimal time until the next token refresh check
   * @returns Time in milliseconds until next refresh
   */
  public calculateRefreshTime(): number {
    const { data } = supabase.auth.getSession();
    const session = data.session;

    if (!session || !session.expires_at) {
      // If no session or expiry, check again in the standard interval
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
  public async refreshSession(): Promise<{ session: Session | null; error: AuthError | null }> {
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
          this.lastRefreshTime = Date.now();
          
          if (error) {
            console.error('Error refreshing session:', error);
            resolve({ session: null, error });
          } else {
            console.log('Session refreshed successfully');
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
      return { error };
    } catch (e) {
      console.error('Error during sign out:', e);
      return { error: e as AuthError };
    }
  }
}

// Export a singleton instance
export const tokenManager = TokenManager.getInstance();
export { TokenManager }; // Also export the class for testing or extension
