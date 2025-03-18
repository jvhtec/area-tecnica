
import { supabase } from "@/lib/supabase";

export class TokenManager {
  private static instance: TokenManager;
  private refreshPromise: Promise<any> | null = null;

  private constructor() {}

  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  // Refresh the session token
  public async refreshToken(): Promise<{session: any | null, error: any | null}> {
    // If there's already a refresh in progress, return that promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Create a new refresh promise
    this.refreshPromise = new Promise(async (resolve) => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        
        resolve({ session: data.session, error });
      } catch (error) {
        console.error("Error refreshing token:", error);
        resolve({ session: null, error });
      } finally {
        // Clear the promise so future calls will create a new one
        this.refreshPromise = null;
      }
    });

    return this.refreshPromise;
  }

  // Check if the token is about to expire
  public async checkTokenExpiration(session: any): Promise<boolean> {
    if (!session) return false;
    
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const now = Date.now();
    
    // If token expires in less than 5 minutes, consider it expired
    return (expiresAt - now) < 5 * 60 * 1000;
  }

  // Get the current session
  public async getSession(): Promise<any> {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session;
    } catch (error) {
      console.error("Error getting session:", error);
      return null;
    }
  }

  // Sign out and clear session
  public async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }
}
