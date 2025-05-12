
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { TokenManager } from "@/lib/token-manager";
import { EventEmitter } from "./event-emitter";
import { toast } from "sonner";

export type SessionStatus = 
  | "active"       // Session is valid and user is authenticated
  | "inactive"     // Session expired or invalidated
  | "refreshing"   // Session is currently being refreshed
  | "recovering"   // Attempting to recover from an error state
  | "error";       // Fatal error in session management

export type SessionEvents = {
  "status-change": SessionStatus;
  "session-refreshed": Session;
  "session-expired": void;
  "refresh-error": Error;
  "user-signed-out": void;
  "recovery-attempt": number;
};

/**
 * Unified session management system that handles authentication state,
 * token refreshing, and recovery from stale sessions
 */
export class SessionManager extends EventEmitter<SessionEvents> {
  private static instance: SessionManager;
  private tokenManager: TokenManager;
  private currentSession: Session | null = null;
  private status: SessionStatus = "inactive";
  private refreshInterval: NodeJS.Timeout | null = null;
  private recoveryAttempts: number = 0;
  private maxRecoveryAttempts: number = 5;
  private recoveryBackoff: number = 5000; // Start with 5 seconds
  private lastActivity: number = Date.now();
  private visibilityChangeHandler: () => void;

  private constructor() {
    super();
    this.tokenManager = TokenManager.getInstance();
    
    // Setup handlers for visibility changes
    this.visibilityChangeHandler = this.handleVisibilityChange.bind(this);
    document.addEventListener("visibilitychange", this.visibilityChangeHandler);
    
    // Setup activity tracking
    this.setupActivityTracking();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Initialize the session manager with the current session
   */
  public async initialize(): Promise<void> {
    console.log("Initializing session manager");
    
    try {
      // Get the current session through token manager for a consistent approach
      const session = await this.tokenManager.getSession(true);
      
      if (session) {
        this.currentSession = session;
        this.setStatus("active");
        this.setupRefreshSchedule(session);
        console.log("Session initialized successfully");
      } else {
        this.setStatus("inactive");
        console.log("No active session found during initialization");
      }
    } catch (error) {
      console.error("Error initializing session:", error);
      this.setStatus("error");
    }
    
    // Set up auth state listener for external changes
    this.setupAuthStateListener();
  }

  /**
   * Set up the auth state change listener
   */
  private setupAuthStateListener(): void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event);
        
        // Handle the events appropriately
        switch (event) {
          case "SIGNED_IN":
            if (session && (!this.currentSession || session.access_token !== this.currentSession.access_token)) {
              this.currentSession = session;
              this.setStatus("active");
              this.setupRefreshSchedule(session);
              this.emit("session-refreshed", session);
            }
            break;
            
          case "SIGNED_OUT":
            this.currentSession = null;
            this.setStatus("inactive");
            this.clearRefreshSchedule();
            this.emit("user-signed-out");
            break;
            
          case "TOKEN_REFRESHED":
            if (session) {
              this.currentSession = session;
              this.setStatus("active");
              this.setupRefreshSchedule(session);
              this.emit("session-refreshed", session);
              this.recoveryAttempts = 0; // Reset recovery attempts on successful refresh
            }
            break;
            
          case "USER_UPDATED":
            if (session) {
              this.currentSession = session;
              this.emit("session-refreshed", session);
            }
            break;
        }
      }
    );
    
    // Store the subscription for cleanup
    this.addCleanupCallback(() => {
      subscription.unsubscribe();
    });
  }
  
  /**
   * Setup user activity tracking
   */
  private setupActivityTracking(): void {
    const trackActivity = () => {
      this.lastActivity = Date.now();
    };
    
    // Track user activity events
    ["mousemove", "mousedown", "keypress", "touchstart", "scroll"].forEach(eventName => {
      window.addEventListener(eventName, trackActivity, { passive: true });
      
      // Add cleanup
      this.addCleanupCallback(() => {
        window.removeEventListener(eventName, trackActivity);
      });
    });
  }

  /**
   * Handle visibility changes for the browser tab
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState === "visible") {
      console.log("Page became visible, checking session state");
      
      // If we have a session, verify it's still valid
      if (this.currentSession) {
        const timeSinceLastActivity = Date.now() - this.lastActivity;
        
        // If inactive for more than 5 minutes, validate the session
        if (timeSinceLastActivity > 5 * 60 * 1000) {
          console.log(`Inactive for ${Math.round(timeSinceLastActivity/1000)} seconds, validating session`);
          this.validateAndRefreshSession();
        }
      }
    }
  }

  /**
   * Calculate when to refresh the token based on its expiry time
   */
  private setupRefreshSchedule(session: Session): void {
    // Clear any existing refresh interval
    this.clearRefreshSchedule();
    
    // Calculate refresh time from token manager
    const refreshTime = this.tokenManager.calculateRefreshTime(session);
    console.log(`Scheduling next token refresh in ${Math.round(refreshTime/1000)} seconds`);
    
    // Set up the refresh interval
    this.refreshInterval = setInterval(() => {
      this.refreshSession();
    }, refreshTime);
  }

  /**
   * Clear the refresh schedule
   */
  private clearRefreshSchedule(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Change the session status and emit status change event
   */
  private setStatus(newStatus: SessionStatus): void {
    if (this.status !== newStatus) {
      const previousStatus = this.status;
      this.status = newStatus;
      console.log(`Session status changed: ${previousStatus} -> ${newStatus}`);
      this.emit("status-change", newStatus);
    }
  }

  /**
   * Get the current session
   */
  public getSession(): Session | null {
    return this.currentSession;
  }

  /**
   * Get the current session status
   */
  public getStatus(): SessionStatus {
    return this.status;
  }

  /**
   * Refresh the session token
   */
  public async refreshSession(): Promise<Session | null> {
    // Skip if already refreshing
    if (this.status === "refreshing") {
      console.log("Session refresh already in progress, skipping");
      return null;
    }
    
    try {
      this.setStatus("refreshing");
      console.log("Refreshing session token");
      
      // Use the token manager to refresh the session
      const { session, error } = await this.tokenManager.refreshToken();
      
      if (error) {
        console.error("Error refreshing token:", error);
        this.handleRefreshError(error);
        return null;
      }
      
      if (session) {
        console.log("Session refreshed successfully");
        this.currentSession = session;
        this.setStatus("active");
        this.setupRefreshSchedule(session);
        this.emit("session-refreshed", session);
        this.recoveryAttempts = 0; // Reset recovery attempts on successful refresh
        return session;
      }
      
      // If we reach here, no session was returned but no error either
      console.log("No session returned from refresh");
      this.setStatus("inactive");
      this.emit("session-expired");
      return null;
    } catch (error) {
      console.error("Exception in refreshSession:", error);
      this.handleRefreshError(error as Error);
      return null;
    }
  }
  
  /**
   * Handle errors that occur during session refresh
   */
  private handleRefreshError(error: Error): void {
    this.emit("refresh-error", error);
    
    // Check if we should try to recover
    if (this.recoveryAttempts < this.maxRecoveryAttempts) {
      this.attemptRecovery();
    } else {
      console.error("Max recovery attempts reached, setting status to error");
      this.setStatus("error");
      
      // Notify the user that they need to reload
      toast.error("Session error", {
        description: "Please reload the page to continue",
        action: {
          label: "Reload",
          onClick: () => window.location.reload(),
        },
      });
    }
  }
  
  /**
   * Attempt to recover from session errors with exponential backoff
   */
  private attemptRecovery(): void {
    this.recoveryAttempts++;
    this.setStatus("recovering");
    
    // Calculate backoff with exponential increase
    const backoff = Math.min(
      this.recoveryBackoff * Math.pow(2, this.recoveryAttempts - 1),
      60000 // Max 1 minute
    );
    
    console.log(`Attempting session recovery ${this.recoveryAttempts}/${this.maxRecoveryAttempts} in ${backoff}ms`);
    this.emit("recovery-attempt", this.recoveryAttempts);
    
    // Try to recover after backoff
    setTimeout(() => {
      this.validateAndRefreshSession();
    }, backoff);
  }
  
  /**
   * Validate the current session and refresh if needed
   */
  public async validateAndRefreshSession(): Promise<boolean> {
    try {
      // First check if we even have a session
      if (!this.currentSession) {
        console.log("No session to validate");
        this.setStatus("inactive");
        return false;
      }
      
      // Check if the token is about to expire
      const isTokenExpiring = await this.tokenManager.checkTokenExpiration(this.currentSession);
      
      if (isTokenExpiring) {
        console.log("Token is expiring soon, refreshing");
        const session = await this.refreshSession();
        return !!session;
      } else {
        console.log("Token is still valid");
        this.setStatus("active");
        return true;
      }
    } catch (error) {
      console.error("Error validating session:", error);
      this.handleRefreshError(error as Error);
      return false;
    }
  }

  /**
   * Sign out the current user
   */
  public async signOut(): Promise<void> {
    try {
      await this.tokenManager.signOut();
      this.currentSession = null;
      this.setStatus("inactive");
      this.clearRefreshSchedule();
      this.emit("user-signed-out");
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }
  
  /**
   * Clean up resources when no longer needed
   */
  public cleanup(): void {
    this.clearRefreshSchedule();
    document.removeEventListener("visibilitychange", this.visibilityChangeHandler);
    this.executeCleanupCallbacks();
  }
}
