
/**
 * Token Manager - Singleton class that manages authentication tokens
 * Provides centralized refresh logic and token state management
 */

import { supabase } from "@/lib/supabase";

type TokenSubscriber = () => void;

export class TokenManager {
  private static instance: TokenManager;
  private subscribers: TokenSubscriber[] = [];
  private lastRefreshTime: number = Date.now();
  private isRefreshInProgress: boolean = false;
  private tokenExpiryTime: number | null = null;
  private refreshTimer: number | null = null;
  
  private constructor() {
    // Initialize and calculate initial token expiry
    this.updateTokenExpiry();
    
    // Listen for auth state changes to update token expiry
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        this.lastRefreshTime = Date.now();
        this.updateTokenExpiry();
        this.notifySubscribers();
      }
    });
    
    // Schedule refresh based on token expiry
    this.scheduleNextRefresh();
    
    // Add visibility change listener to refresh token when tab becomes active
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      
      // Listen for custom token refresh events
      window.addEventListener('token-refresh-needed', this.refreshToken);
    }
  }
  
  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }
  
  private updateTokenExpiry = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      
      if (session?.expires_at) {
        // Convert expires_at to milliseconds timestamp
        this.tokenExpiryTime = session.expires_at * 1000;
        console.log("Token expires at:", new Date(this.tokenExpiryTime));
      }
    } catch (error) {
      console.error("Error updating token expiry:", error);
    }
  }
  
  private scheduleNextRefresh = () => {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    if (!this.tokenExpiryTime) {
      // No token expiry, check again in 5 minutes
      this.refreshTimer = window.setTimeout(this.refreshToken, 5 * 60 * 1000);
      return;
    }
    
    const now = Date.now();
    const expiresIn = this.tokenExpiryTime - now;
    
    if (expiresIn <= 0) {
      // Token expired, refresh now
      this.refreshToken();
      return;
    }
    
    // Schedule refresh at 85% of token lifetime to ensure we refresh before expiry
    const refreshIn = Math.min(expiresIn * 0.85, 60 * 60 * 1000); // Max 1 hour
    
    console.log(`Next token refresh scheduled in ${Math.round(refreshIn / 1000)} seconds`);
    this.refreshTimer = window.setTimeout(this.refreshToken, refreshIn);
  }
  
  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // Check if token needs refresh after tab becomes active
      const timeSinceLastRefresh = Date.now() - this.lastRefreshTime;
      if (timeSinceLastRefresh > 5 * 60 * 1000) { // 5 minutes
        console.log("Tab became active, refreshing token");
        this.refreshToken();
      }
    }
  }
  
  public refreshToken = async () => {
    if (this.isRefreshInProgress) {
      console.log("Token refresh already in progress");
      return { session: null, error: null };
    }
    
    try {
      this.isRefreshInProgress = true;
      console.log("Refreshing token...");
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error("Error refreshing token:", error);
        return { session: null, error };
      }
      
      if (data.session) {
        this.lastRefreshTime = Date.now();
        this.updateTokenExpiry();
        this.scheduleNextRefresh();
        this.notifySubscribers();
        return { session: data.session, error: null };
      } else {
        console.log("No session found during refresh");
        return { session: null, error: null };
      }
    } catch (error) {
      console.error("Unexpected error in refreshToken:", error);
      return { session: null, error };
    } finally {
      this.isRefreshInProgress = false;
    }
  }
  
  public getTimeSinceLastRefresh(): number {
    return this.lastRefreshTime;
  }
  
  public getSession = async (forceRefresh = false) => {
    if (forceRefresh) {
      return this.refreshToken();
    } else {
      return supabase.auth.getSession();
    }
  }
  
  public subscribe(callback: TokenSubscriber): () => void {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }
  
  private notifySubscribers() {
    this.subscribers.forEach(callback => callback());
  }
  
  public cleanup() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('token-refresh-needed', this.refreshToken);
    }
    
    this.subscribers = [];
  }
}
