
import { supabase } from "@/lib/supabase";

// Session check service for validating and refreshing auth sessions
export class SessionCheckService {
  private lastCheckTime = 0;
  private refreshInProgress = false;

  // Check if the current session is valid
  async checkSession(): Promise<boolean> {
    // Avoid too frequent checks
    const now = Date.now();
    if (now - this.lastCheckTime < 10000 && !this.refreshInProgress) { // 10 seconds
      console.log("Using cached session status");
      return true; // Assume valid if we checked recently
    }

    this.lastCheckTime = now;
    
    try {
      // First, check if we have a session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log("No active session found");
        return false;
      }
      
      // If the session expires soon (within 5 minutes), refresh it
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const expiresIn = expiresAt - Date.now();
      
      if (expiresIn < 5 * 60 * 1000) { // 5 minutes
        console.log(`Session expires in ${Math.round(expiresIn/1000)}s, refreshing`);
        return await this.refreshSession();
      }
      
      console.log("Session is valid");
      return true;
    } catch (error) {
      console.error("Error checking session:", error);
      return false;
    }
  }

  // Refresh the session
  private async refreshSession(): Promise<boolean> {
    if (this.refreshInProgress) {
      console.log("Session refresh already in progress");
      return true;
    }
    
    this.refreshInProgress = true;
    
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error("Failed to refresh session:", error);
        return false;
      }
      
      if (data.session) {
        console.log("Session refreshed successfully");
        return true;
      }
      
      console.log("No session after refresh attempt");
      return false;
    } catch (error) {
      console.error("Exception during session refresh:", error);
      return false;
    } finally {
      this.refreshInProgress = false;
    }
  }

  // Get the user ID from the current session
  async getCurrentUserId(): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user?.id || null;
    } catch (error) {
      console.error("Error getting current user ID:", error);
      return null;
    }
  }
}
