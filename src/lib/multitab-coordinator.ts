import { QueryClient } from '@tanstack/react-query';

interface TabMessage {
  type: 'cache-update' | 'invalidate' | 'leader-election' | 'heartbeat' | 'subscription-request';
  queryKey?: any;
  data?: any;
  tabId?: string;
  timestamp?: number;
  tables?: string[];
}

interface TabState {
  tabId: string;
  isLeader: boolean;
  lastSeen: number;
  queryClient: QueryClient;
}

/**
 * Multi-tab coordinator that manages leader election and cross-tab communication
 * to optimize performance when multiple tabs are open with the same user
 */
export class MultiTabCoordinator {
  private static instance: MultiTabCoordinator | null = null;
  private tabId: string;
  private isLeader: boolean = false;
  private queryClient: QueryClient;
  private broadcastChannel: BroadcastChannel;
  private leaderElectionInterval: number | null = null;
  private heartbeatInterval: number | null = null;
  private visibilityListener: (() => void) | null = null;
  private queryCacheUnsubscribe: (() => void) | null = null;
  private lastBroadcastedUpdatedAt: Map<string, number> = new Map();
  private pendingBroadcasts: Map<string, { queryKey: any; data: any; updatedAt: number }> = new Map();
  private broadcastFlushTimeout: number | null = null;
  private lockAcquired: boolean = false;
  private lastLeaderSeen: number = Date.now();
  
  private constructor(queryClient: QueryClient) {
    this.tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.queryClient = queryClient;
    this.broadcastChannel = new BroadcastChannel('sector-pro-tabs');
    
    this.setupBroadcastChannel();
    this.setupVisibilityHandling();
    this.startLeaderElection();
    this.setupQueryClientSync();
    
    console.log(`MultiTabCoordinator initialized for tab: ${this.tabId}`);
  }

  public static getInstance(queryClient: QueryClient): MultiTabCoordinator {
    if (!MultiTabCoordinator.instance) {
      MultiTabCoordinator.instance = new MultiTabCoordinator(queryClient);
    }
    return MultiTabCoordinator.instance;
  }

  public getTabId(): string {
    return this.tabId;
  }

  public getIsLeader(): boolean {
    return this.isLeader;
  }

  private setupBroadcastChannel() {
    this.broadcastChannel.addEventListener('message', (event: MessageEvent<TabMessage>) => {
      const { type, queryKey, data, tabId, timestamp, tables } = event.data;
      
      // Ignore messages from ourselves
      if (tabId === this.tabId) return;
      
      switch (type) {
        case 'cache-update':
          if (queryKey) {
            this.queryClient.setQueryData(queryKey, data);
          }
          break;
          
        case 'invalidate':
          const refetchType = this.isLeader ? 'active' : 'none';
          if (queryKey) {
            this.queryClient.invalidateQueries({ queryKey, refetchType } as any);
          } else {
            this.queryClient.invalidateQueries({ refetchType } as any);
          }
          break;
          
        case 'leader-election':
          if (timestamp && timestamp > this.lastLeaderSeen) {
            this.lastLeaderSeen = timestamp;
            // If another tab is claiming leadership and we're not the leader, accept it
            if (this.isLeader && tabId !== this.tabId) {
              this.becomeFollower();
            }
          }
          break;
          
        case 'heartbeat':
          if (timestamp) {
            this.lastLeaderSeen = timestamp;
          }
          break;
          
        case 'subscription-request':
          // Only process if we're the leader
          if (this.isLeader && tables) {
            this.handleSubscriptionRequest(tables);
          }
          break;
      }
    });
  }

  private async startLeaderElection() {
    try {
      // Try to acquire the leader lock
      if ('locks' in navigator) {
        await navigator.locks.request('sector-pro-leader', { mode: 'exclusive', ifAvailable: true }, (lock) => {
          if (lock) {
            this.lockAcquired = true;
            this.becomeLeader();
            
            // Keep the lock until the tab closes
            return new Promise(() => {
              // This promise never resolves, keeping the lock
            });
          } else {
            this.becomeFollower();
          }
          return Promise.resolve();
        });
      } else {
        // Fallback for browsers without Web Locks API
        this.fallbackLeaderElection();
      }
    } catch (error) {
      console.error('Error in leader election:', error);
      this.fallbackLeaderElection();
    }
  }

  private fallbackLeaderElection() {
    if (document.hidden) {
      return;
    }

    // Fallback leader election using localStorage and timestamps
    const checkLeader = () => {
      const leaderInfo = localStorage.getItem('sector-pro-leader');
      const now = Date.now();
      
      if (!leaderInfo) {
        this.claimLeadership();
        return;
      }
      
      try {
        const { tabId, timestamp } = JSON.parse(leaderInfo);
        
        // If leader hasn't been seen for 10 seconds, claim leadership
        if (now - timestamp > 10000) {
          this.claimLeadership();
        } else if (tabId === this.tabId) {
          this.becomeLeader();
        } else {
          this.becomeFollower();
        }
      } catch (error) {
        console.error('Error parsing leader info:', error);
        this.claimLeadership();
      }
    };
    
    // Check leader status every 5 seconds
    this.leaderElectionInterval = window.setInterval(checkLeader, 5000);
    checkLeader();
  }

  private setupVisibilityHandling() {
    const handleVisibility = () => {
      if (document.hidden) {
        this.pauseIntervals();
      } else {
        this.resumeIntervals();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility, { passive: true });
    this.visibilityListener = handleVisibility;

    // Ensure we start in the correct state.
    handleVisibility();
  }

  private pauseIntervals() {
    if (this.leaderElectionInterval) {
      clearInterval(this.leaderElectionInterval);
      this.leaderElectionInterval = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private resumeIntervals() {
    if (this.isLeader && !this.heartbeatInterval) {
      this.startHeartbeat();
    }

    if (!('locks' in navigator) && !this.leaderElectionInterval) {
      this.fallbackLeaderElection();
    }
  }

  private startHeartbeat() {
    // Start heartbeat
    this.heartbeatInterval = window.setInterval(() => {
      this.broadcast({
        type: 'heartbeat',
        tabId: this.tabId,
        timestamp: Date.now()
      });

      // Update localStorage for fallback election
      if (!('locks' in navigator)) {
        const leaderInfo = {
          tabId: this.tabId,
          timestamp: Date.now()
        };
        localStorage.setItem('sector-pro-leader', JSON.stringify(leaderInfo));
      }
    }, 3000);
  }

  private claimLeadership() {
    const leaderInfo = {
      tabId: this.tabId,
      timestamp: Date.now()
    };
    localStorage.setItem('sector-pro-leader', JSON.stringify(leaderInfo));
    this.becomeLeader();
  }

  private becomeLeader() {
    if (this.isLeader) return;
    
    this.isLeader = true;
    console.log(`Tab ${this.tabId} became leader`);
    
    // Announce leadership
    this.broadcast({
      type: 'leader-election',
      tabId: this.tabId,
      timestamp: Date.now()
    });
    
    if (!document.hidden) {
      this.startHeartbeat();
    }
    
    // Dispatch custom event for the app to know about leadership change
    window.dispatchEvent(new CustomEvent('tab-leader-elected', { detail: { isLeader: true } }));
  }

  private becomeFollower() {
    if (!this.isLeader) return;
    
    this.isLeader = false;
    console.log(`Tab ${this.tabId} became follower`);
    
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Dispatch custom event for the app to know about leadership change
    window.dispatchEvent(new CustomEvent('tab-leader-elected', { detail: { isLeader: false } }));
  }

  private setupQueryClientSync() {
    // Clean up previous subscription if we ever recreate the coordinator.
    if (this.queryCacheUnsubscribe) {
      this.queryCacheUnsubscribe();
      this.queryCacheUnsubscribe = null;
    }

    // Broadcast successful query results from the leader to followers.
    // This reduces redundant refetching across tabs.
    this.queryCacheUnsubscribe = this.queryClient.getQueryCache().subscribe((event) => {
      if (!this.isLeader) return;
      if (event.type !== 'updated') return;

      const query = event.query;
      if (query.state.status !== 'success') return;

      const queryKey = query.queryKey as any;
      const serializedKey = JSON.stringify(queryKey);
      const updatedAt = (query.state as any).dataUpdatedAt ?? 0;
      const last = this.lastBroadcastedUpdatedAt.get(serializedKey) ?? 0;
      if (updatedAt <= last) return;

      this.lastBroadcastedUpdatedAt.set(serializedKey, updatedAt);
      this.pendingBroadcasts.set(serializedKey, {
        queryKey,
        data: query.state.data,
        updatedAt,
      });

      this.scheduleBroadcastFlush();
    });
  }

  private scheduleBroadcastFlush() {
    if (this.broadcastFlushTimeout) {
      return;
    }

    this.broadcastFlushTimeout = window.setTimeout(() => {
      this.broadcastFlushTimeout = null;
      const items = Array.from(this.pendingBroadcasts.values());
      this.pendingBroadcasts.clear();
      items.forEach(({ queryKey, data }) => {
        this.broadcast({
          type: 'cache-update',
          queryKey,
          data,
          tabId: this.tabId,
        });
      });
    }, 75);
  }

  private handleSubscriptionRequest(tables: string[]) {
    // This would be implemented when we add Phase 2 functionality
    // For now, just log the request
    console.log('Subscription request received for tables:', tables);
  }

  public broadcast(message: TabMessage) {
    try {
      this.broadcastChannel.postMessage({
        ...message,
        tabId: this.tabId,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error broadcasting message:', error);
    }
  }

  public invalidateQueries(queryKey?: any) {
    // Always invalidate locally first
    const refetchType = this.isLeader ? 'active' : 'none';
    if (queryKey) {
      this.queryClient.invalidateQueries({ queryKey, refetchType } as any);
    } else {
      this.queryClient.invalidateQueries({ refetchType } as any);
    }
    
    // If we're the leader, broadcast to other tabs
    if (this.isLeader) {
      this.broadcast({
        type: 'invalidate',
        queryKey,
        tabId: this.tabId
      });
    }
  }

  public requestSubscriptions(tables: string[]) {
    // If we're a follower, request the leader to handle subscriptions
    if (!this.isLeader) {
      this.broadcast({
        type: 'subscription-request',
        tables,
        tabId: this.tabId
      });
    }
  }

  public destroy() {
    if (this.leaderElectionInterval) {
      clearInterval(this.leaderElectionInterval);
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.visibilityListener) {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }

    if (this.queryCacheUnsubscribe) {
      this.queryCacheUnsubscribe();
      this.queryCacheUnsubscribe = null;
    }

    if (this.broadcastFlushTimeout) {
      clearTimeout(this.broadcastFlushTimeout);
      this.broadcastFlushTimeout = null;
    }
    
    this.broadcastChannel.close();
    
    // Clean up localStorage if we were the leader
    if (this.isLeader && !('locks' in navigator)) {
      const leaderInfo = localStorage.getItem('sector-pro-leader');
      if (leaderInfo) {
        try {
          const { tabId } = JSON.parse(leaderInfo);
          if (tabId === this.tabId) {
            localStorage.removeItem('sector-pro-leader');
          }
        } catch (error) {
          console.error('Error cleaning up leader info:', error);
        }
      }
    }
    
    MultiTabCoordinator.instance = null;
  }
}

// Hook to use the coordinator
export function useMultiTabCoordinator(queryClient: QueryClient) {
  const coordinator = MultiTabCoordinator.getInstance(queryClient);
  
  return {
    tabId: coordinator.getTabId(),
    isLeader: coordinator.getIsLeader(),
    invalidateQueries: coordinator.invalidateQueries.bind(coordinator),
    requestSubscriptions: coordinator.requestSubscriptions.bind(coordinator)
  };
}
