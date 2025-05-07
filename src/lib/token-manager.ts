
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";

// Simple token manager for coordinating token refreshes
export class TokenManager {
  private static instance: TokenManager | null = null;
  private subscribers: Array<() => void> = [];
  private lastRefreshTime = 0;
  
  private constructor() {}
  
  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }
  
  // Notify all subscribers that a token has been refreshed
  notifyRefresh() {
    this.lastRefreshTime = Date.now();
    console.log(`Token refreshed, notifying ${this.subscribers.length} subscribers`);
    this.subscribers.forEach(callback => callback());
  }
  
  // Subscribe to token refresh events
  subscribe(callback: () => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }
  
  // Get the time since the last token refresh
  getTimeSinceLastRefresh(): number {
    return Date.now() - this.lastRefreshTime;
  }
  
  // Refresh the authentication token - new method
  async refreshToken(): Promise<{ session: Session | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        return { session: null, error };
      }
      
      if (data?.session) {
        this.lastRefreshTime = Date.now();
        this.notifyRefresh();
        return { session: data.session, error: null };
      }
      
      return { session: null, error: new Error("No session returned from refresh") };
    } catch (error) {
      return { session: null, error: error instanceof Error ? error : new Error("Unknown error during token refresh") };
    }
  }
  
  // Get the current session - new method
  async getSession(): Promise<Session | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session || null;
    } catch (error) {
      console.error("Error getting session:", error);
      return null;
    }
  }
  
  // Sign out the current user - new method
  async signOut(): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { error };
      }
      
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error("Unknown error during sign out") };
    }
  }
  
  // Calculate optimal time to refresh token - new method
  calculateRefreshTime(session: Session): number {
    if (!session.expires_at) {
      return 30 * 60 * 1000; // Default to 30 minutes if no expiry available
    }
    
    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = Math.max(0, expiresAt - now);
    
    // Refresh at halfway point or 5 minutes before expiry, whichever is sooner
    // But never wait longer than 30 minutes between refreshes
    return Math.min(
      timeUntilExpiry / 2,
      timeUntilExpiry - (5 * 60 * 1000),
      30 * 60 * 1000
    );
  }
  
  // Check if token will expire within the specified time - new method
  checkTokenExpiration(session: Session, timeWindow: number): boolean {
    if (!session.expires_at) {
      return false;
    }
    
    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    
    return timeUntilExpiry <= timeWindow;
  }
}
