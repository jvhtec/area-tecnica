
import { supabase } from './supabase-client';
import { TokenManager } from './token-manager';

/**
 * Service that handles automatic recovery of connections
 * when network issues or token expiration occurs
 */
export const connectionRecovery = {
  isActive: false,
  recoveryInterval: null as NodeJS.Timeout | null,
  lastRecoveryAttempt: 0,
  recoveryInProgress: false,
  consecutiveFailures: 0,
  maxRetryDelay: 30000, // 30 seconds maximum backoff

  pauseHealthCheck() {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }
  },

  resumeHealthCheck() {
    if (this.recoveryInterval) {
      return;
    }

    this.recoveryInterval = setInterval(() => this.performHealthCheck(), 60000); // Every minute
  },
  
  startRecovery() {
    if (this.isActive) return;
    this.isActive = true;
    
    console.log('Starting connection recovery service');
    
    // Add online/offline event listeners
    window.addEventListener('online', this.handleNetworkStatusChange);
    window.addEventListener('offline', this.handleNetworkStatusChange);
    
    // Add visibility change listener
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Setup periodic health check
    if (!document.hidden) {
      this.resumeHealthCheck();
    }
    
    // Perform initial health check
    setTimeout(() => this.performHealthCheck(), 5000);
  },
  
  stopRecovery() {
    if (!this.isActive) return;
    
    console.log('Stopping connection recovery service');
    
    // Remove event listeners
    window.removeEventListener('online', this.handleNetworkStatusChange);
    window.removeEventListener('offline', this.handleNetworkStatusChange);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Clear interval
    this.pauseHealthCheck();
    
    this.isActive = false;
  },
  
  handleNetworkStatusChange() {
    if (navigator.onLine) {
      console.log('Network connection restored, triggering recovery');
      // Dispatch custom event for Supabase reconnect
      window.dispatchEvent(new CustomEvent('supabase-reconnect'));
      
      // Force refreshing token
      TokenManager.getInstance().refreshToken().catch(err => {
        console.error('Error refreshing token on network change:', err);
      });
    } else {
      console.log('Network connection lost');
    }
  },
  
  handleVisibilityChange() {
    if (document.hidden) {
      connectionRecovery.pauseHealthCheck();
      return;
    }

    console.log('Tab became visible, checking connection health');
    connectionRecovery.resumeHealthCheck();
    // Schedule health check with a slight delay to ensure everything is loaded
    setTimeout(() => connectionRecovery.performHealthCheck(), 1000);
  },
  
  async performHealthCheck() {
    if (this.recoveryInProgress) return;
    
    // Don't check too frequently
    const now = Date.now();
    if (now - this.lastRecoveryAttempt < 30000) return; // 30 seconds minimum between attempts
    
    try {
      this.recoveryInProgress = true;
      this.lastRecoveryAttempt = now;
      
      console.log('Performing connection health check');
      
      // Get authentication session
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      
      if (!session) {
        console.log('No active session found during health check');
        return;
      }
      
      // Check token expiration
      const tokenManager = TokenManager.getInstance();
      const isExpiring = await tokenManager.checkTokenExpiration(session, 10 * 60 * 1000); // 10 minute buffer
      
      if (isExpiring) {
        console.log('Token is expiring soon, refreshing');
        await tokenManager.refreshToken();
      }
      
      // Check realtime connection
      const channels = supabase.getChannels();
      const hasHealthyConnection = channels.some(channel => channel.state === 'joined');
      
      if (!hasHealthyConnection && channels.length > 0) {
        console.log('Realtime connection unhealthy, triggering reconnect');
        window.dispatchEvent(new CustomEvent('supabase-reconnect'));
        
        // Apply backoff if we have consecutive failures
        if (this.consecutiveFailures > 0) {
          const backoffDelay = Math.min(
            Math.pow(2, this.consecutiveFailures) * 1000, 
            this.maxRetryDelay
          );
          console.log(`Applying exponential backoff: ${backoffDelay}ms after ${this.consecutiveFailures} failures`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
        this.consecutiveFailures++;
      } else if (hasHealthyConnection) {
        // Reset failures counter when connection is healthy
        this.consecutiveFailures = 0;
      }
      
    } catch (error) {
      console.error('Error in connection health check:', error);
      this.consecutiveFailures++;
    } finally {
      this.recoveryInProgress = false;
    }
  }
};
