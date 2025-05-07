
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
}
