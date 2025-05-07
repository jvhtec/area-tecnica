
import { SessionCheckService } from "./session-check-service";
import { toast } from "sonner";

// Enhanced connection recovery service
class ConnectionRecoveryService {
  private sessionCheckService: SessionCheckService;
  private isRecoveryActive = false;
  private recoveryAttempts = 0;
  private maxRecoveryAttempts = 5;
  private lastRecoveryTime = 0;
  private recoveryInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.sessionCheckService = new SessionCheckService();
  }

  // Start the recovery service
  startRecovery() {
    if (this.isRecoveryActive) {
      return;
    }

    console.log("Starting connection recovery service");
    this.isRecoveryActive = true;
    this.recoveryAttempts = 0;

    // Set up network status monitoring
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Set up visibility change monitoring
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

    // Set up periodic health checks
    this.healthCheckInterval = setInterval(() => this.performHealthCheck(), 60000); // Every minute
  }

  // Stop the recovery service
  stopRecovery() {
    if (!this.isRecoveryActive) {
      return;
    }

    console.log("Stopping connection recovery service");
    this.isRecoveryActive = false;

    // Clear any pending intervals
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Remove event listeners
    window.removeEventListener('online', () => this.handleOnline());
    window.removeEventListener('offline', () => this.handleOffline());
    document.removeEventListener('visibilitychange', () => this.handleVisibilityChange());
  }

  // Handle browser coming online
  private handleOnline() {
    console.log("Network connection detected");
    
    // Dispatch a custom event that subscription managers can listen for
    const event = new CustomEvent('supabase-reconnect', {
      detail: { reason: 'online' }
    });
    window.dispatchEvent(event);
    
    // Trigger recovery
    this.performRecovery('network-reconnect');
  }

  // Handle browser going offline
  private handleOffline() {
    console.log("Network connection lost");
    toast.error("Network connection lost", {
      description: "Trying to reconnect...",
      duration: 3000
    });
  }

  // Handle tab visibility changes
  private handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      console.log("Tab became visible");
      
      // Calculate time since last visibility
      const timeSinceLastActivity = Date.now() - this.lastRecoveryTime;
      
      // If we've been away for a while, perform recovery
      if (timeSinceLastActivity > 5 * 60 * 1000) { // 5 minutes
        console.log(`Tab was inactive for ${Math.round(timeSinceLastActivity/1000)}s, performing recovery`);
        this.performRecovery('visibility-change');
      }
    }
  }

  // Perform connection recovery
  async performRecovery(reason: string) {
    // Avoid too frequent recovery attempts
    const now = Date.now();
    if (now - this.lastRecoveryTime < 10000) { // 10 seconds
      console.log("Skipping recovery, too soon since last attempt");
      return;
    }
    
    this.lastRecoveryTime = now;
    this.recoveryAttempts += 1;
    
    console.log(`Performing connection recovery (Attempt ${this.recoveryAttempts}, reason: ${reason})`);
    
    try {
      // Check session first
      const isSessionValid = await this.sessionCheckService.checkSession();
      
      if (!isSessionValid) {
        console.log("Session is invalid, directing to login");
        toast.error("Session expired", {
          description: "Please log in again",
          duration: 5000
        });
        
        // Redirect to auth page
        window.location.href = "/auth";
        return;
      }
      
      // Session is valid, trigger reconnect events
      const reconnectEvent = new CustomEvent('force-data-refresh', {
        detail: { reason }
      });
      window.dispatchEvent(reconnectEvent);
      
      // Reset recovery attempts on success
      this.recoveryAttempts = 0;
      
      // Show success toast only if recovering from a known issue
      if (reason === 'network-reconnect' || reason === 'health-check-failed') {
        toast.success("Connection restored", {
          description: "Your data has been refreshed",
          duration: 3000
        });
      }
    } catch (error) {
      console.error("Error during connection recovery:", error);
      
      // If we've reached max attempts, suggest more drastic measures
      if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
        toast.error("Connection issues persist", {
          description: "Consider refreshing the page",
          duration: 8000
        });
      }
    }
  }

  // Perform periodic health check
  private async performHealthCheck() {
    if (!this.isRecoveryActive) {
      return;
    }
    
    try {
      // Simple check to Supabase health endpoint
      const response = await fetch(`${process.env.VITE_SUPABASE_URL}/health`, {
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        console.log(`Health check failed: ${response.status} ${response.statusText}`);
        this.performRecovery('health-check-failed');
      }
    } catch (error) {
      console.error("Health check error:", error);
      this.performRecovery('health-check-failed');
    }
  }
}

// Export as singleton
export const connectionRecovery = new ConnectionRecoveryService();
