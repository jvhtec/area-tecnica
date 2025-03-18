
import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export class SubscriptionManager {
  private static instance: SubscriptionManager;
  private queryClient: QueryClient;
  private subscriptions: Map<string, { unsubscribe: () => void }> = new Map();
  
  private constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }
  
  static getInstance(queryClient: QueryClient): SubscriptionManager {
    if (!SubscriptionManager.instance) {
      SubscriptionManager.instance = new SubscriptionManager(queryClient);
    }
    return SubscriptionManager.instance;
  }
  
  subscribeToTable(table: string, queryKey: string | string[]) {
    if (this.subscriptions.has(table)) return;
    
    const channel = supabase.channel(`${table}-changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        async (payload) => {
          // Intelligently invalidate only affected queries
          const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
          keys.forEach(key => {
            this.queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      )
      .subscribe();
    
    this.subscriptions.set(table, { unsubscribe: () => supabase.removeChannel(channel) });
  }
  
  unsubscribeFromTable(table: string) {
    const subscription = this.subscriptions.get(table);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(table);
    }
  }
  
  unsubscribeAll() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions.clear();
  }
  
  // Smart refetching strategy hooks
  setupVisibilityBasedRefetching() {
    let lastRefetchTime = Date.now();
    const THROTTLE_TIME = 10000; // 10 seconds minimum between refetches
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastRefetchTime > THROTTLE_TIME) {
          // Only refetch when sufficient time has passed since last refetch
          this.queryClient.invalidateQueries();
          lastRefetchTime = now;
        }
      }
    });
  }
  
  setupNetworkStatusRefetching() {
    window.addEventListener('online', () => {
      // When coming back online, invalidate all queries to get fresh data
      this.queryClient.invalidateQueries();
    });
  }
}
