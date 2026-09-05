import { QueryClient, type QueryKey } from '@tanstack/react-query';
import {
  UnifiedSubscriptionManager,
  type RealtimeSubscriptionFilter,
} from '@/lib/unified-subscription-manager';
import { APP_RUNTIME_EVENTS, subscribeAppRuntimeEvent } from '@/runtime/app-runtime-events';
import type { SubscriptionQueryKey } from '@/lib/unified-subscription-support';
import { getPrivateDataScope, subscribePrivateDataScope } from '@/lib/private-data-scope';

const currentScopeKey = (): string | null => {
  const scope = getPrivateDataScope();
  return scope ? JSON.stringify([scope.userId, scope.authorizationKey]) : null;
};

type SubscriptionPriority = 'high' | 'medium' | 'low';

export interface DelegatedRouteSubscription {
  table: string;
  queryKey: SubscriptionQueryKey;
  filter?: RealtimeSubscriptionFilter;
  priority?: SubscriptionPriority;
}

export interface RouteSubscriptionRequest {
  routeKey: string;
  subscriptions: DelegatedRouteSubscription[];
}

interface TabMessage {
  scopeKey?: string;
  type: 'cache-update' | 'invalidate' | 'leader-election' | 'heartbeat' | 'subscription-request' | 'subscription-release';
  queryKey?: QueryKey;
  data?: unknown;
  tabId?: string;
  timestamp?: number;
  tables?: string[];
  routeKey?: string;
  subscriptions?: DelegatedRouteSubscription[];
}

interface TabState {
  tabId: string;
  isLeader: boolean;
  lastSeen: number;
  queryClient: QueryClient;
}

const FALLBACK_HEARTBEAT_INTERVAL_MS = 5_000;

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
  private visibilityUnsubscribe: (() => void) | null = null;
  private queryCacheUnsubscribe: (() => void) | null = null;
  private lastBroadcastedUpdatedAt: Map<string, number> = new Map();
  private pendingBroadcasts: Map<string, { queryKey: QueryKey; data: unknown; updatedAt: number }> = new Map();
  private broadcastFlushTimeout: number | null = null;
  private lockAcquired: boolean = false;
  private lastLeaderSeen: number = Date.now();
  private scopeKey = currentScopeKey();
  private scopeUnsubscribe: (() => void) | null = null;
  private releaseLeaderLock: (() => void) | null = null;
  private destroyed = false;
  private scopeRevision = 0;
  private delegatedOwners = new Set<string>();

  private get leaderKey() { return `sector-pro-leader:${this.scopeKey ?? 'signed-out'}`; }
  private get channelName() { return `sector-pro-tabs:${this.scopeKey ?? 'signed-out'}`; }
  
  private constructor(queryClient: QueryClient) {
    this.tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.queryClient = queryClient;
    this.broadcastChannel = new BroadcastChannel(this.channelName);
    this.scopeUnsubscribe = subscribePrivateDataScope(() => this.resetForIdentity());
    
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
    const channel = this.broadcastChannel;
    channel.addEventListener('message', (event: MessageEvent<TabMessage>) => {
      if (this.destroyed || channel !== this.broadcastChannel || !this.scopeKey || event.data.scopeKey !== this.scopeKey) return;
      const { type, queryKey, data, tabId, timestamp, tables, routeKey, subscriptions } = event.data;
      
      // Ignore messages from ourselves
      if (tabId === this.tabId) return;
      
      switch (type) {
        case 'cache-update':
          if (queryKey) {
            this.queryClient.setQueryData(queryKey, data);
          }
          break;
          
        case 'invalidate': {
          const refetchType = this.isLeader ? 'active' : 'none';
          if (queryKey) {
            this.queryClient.invalidateQueries({ queryKey, refetchType });
          } else {
            this.queryClient.invalidateQueries({ refetchType });
          }
          break;
        }
          
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
          if (this.isLeader) {
            this.handleSubscriptionRequest({
              requesterTabId: tabId,
              routeKey,
              subscriptions,
              tables,
            });
          }
          break;

        case 'subscription-release':
          if (this.isLeader && routeKey) {
            this.handleSubscriptionRelease(routeKey, tabId);
          }
          break;
      }
    });
  }

  private async startLeaderElection() {
    if (this.destroyed || !this.scopeKey) return;
    const revision = this.scopeRevision;
    try {
      // Try to acquire the leader lock
      if ('locks' in navigator) {
        await navigator.locks.request(this.leaderKey, { mode: 'exclusive', ifAvailable: true }, (lock) => {
          if (this.destroyed || this.scopeRevision !== revision) return;
          if (lock) {
            this.lockAcquired = true;
            this.becomeLeader();
            
            // Release on account change and teardown, including React remounts.
            return new Promise<void>((resolve) => {
              this.releaseLeaderLock = resolve;
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
      if (this.destroyed || this.scopeRevision !== revision) return;
      console.error('Error in leader election:', error);
      this.fallbackLeaderElection();
    }
  }

  private fallbackLeaderElection() {
    if (this.destroyed || !this.scopeKey || document.hidden || this.leaderElectionInterval) {
      return;
    }

    // Fallback leader election using localStorage and timestamps
    const checkLeader = () => {
      const leaderInfo = localStorage.getItem(this.leaderKey);
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
    const unsubscribeHidden = subscribeAppRuntimeEvent(APP_RUNTIME_EVENTS.HIDDEN, () => {
      this.pauseIntervals();
    });

    const unsubscribeVisible = subscribeAppRuntimeEvent(APP_RUNTIME_EVENTS.VISIBLE, () => {
      this.resumeIntervals();
    });

    this.visibilityUnsubscribe = () => {
      unsubscribeHidden();
      unsubscribeVisible();
    };

    // Ensure we start in the correct state.
    if (document.hidden) {
      this.pauseIntervals();
    } else {
      this.resumeIntervals();
    }
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
        localStorage.setItem(this.leaderKey, JSON.stringify(leaderInfo));
      }
    }, FALLBACK_HEARTBEAT_INTERVAL_MS);
  }

  private claimLeadership() {
    const leaderInfo = {
      tabId: this.tabId,
      timestamp: Date.now()
    };
    localStorage.setItem(this.leaderKey, JSON.stringify(leaderInfo));
    this.becomeLeader();
  }

  private becomeLeader() {
    if (this.destroyed || !this.scopeKey || this.isLeader) return;
    
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

      const queryKey = query.queryKey;
      const serializedKey = JSON.stringify(queryKey);
      const updatedAt = query.state.dataUpdatedAt ?? 0;
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

  private handleSubscriptionRequest({
    requesterTabId,
    routeKey,
    subscriptions,
    tables,
  }: {
    requesterTabId?: string;
    routeKey?: string;
    subscriptions?: DelegatedRouteSubscription[];
    tables?: string[];
  }) {
    const requestedSubscriptions: DelegatedRouteSubscription[] =
      subscriptions && subscriptions.length > 0
        ? subscriptions
        : (tables ?? []).map((table) => ({
            table,
            queryKey: [table],
            priority: 'medium' as const,
          }));

    if (requestedSubscriptions.length === 0) {
      return;
    }

    const ownerRoute = this.getDelegatedOwnerRoute(routeKey, requesterTabId);
    this.delegatedOwners.add(ownerRoute);
    const manager = UnifiedSubscriptionManager.getInstance(this.queryClient);

    requestedSubscriptions.forEach(({ table, queryKey, filter, priority }) => {
      const subscription = manager.subscribeToTable(
        table,
        queryKey,
        filter,
        priority ?? 'medium',
      );

      if (subscription?.key) {
        manager.registerRouteSubscription(ownerRoute, subscription.key);
      }
    });

    manager.markRefreshed();

    if (import.meta.env.DEV) {
      console.debug('[MultiTabCoordinator] Leader handled subscription request', {
        ownerRoute,
        requesterTabId,
        tables: requestedSubscriptions.map((subscription) => subscription.table),
      });
    }
  }

  private getDelegatedOwnerRoute(routeKey?: string, requesterTabId?: string) {
    return `${routeKey ?? 'delegated'}:${requesterTabId ?? 'unknown-tab'}`;
  }

  private handleSubscriptionRelease(routeKey: string, requesterTabId?: string) {
    const ownerRoute = this.getDelegatedOwnerRoute(routeKey, requesterTabId);
    this.delegatedOwners.delete(ownerRoute);
    const manager = UnifiedSubscriptionManager.getInstance(this.queryClient);

    manager.cleanupRouteDependentSubscriptions(ownerRoute);

    if (import.meta.env.DEV) {
      console.debug('[MultiTabCoordinator] Leader released delegated subscriptions', {
        ownerRoute,
        requesterTabId,
      });
    }
  }

  public broadcast(message: TabMessage) {
    if (this.destroyed || !this.scopeKey) return;
    try {
      this.broadcastChannel.postMessage({
        ...message,
        scopeKey: this.scopeKey,
        tabId: this.tabId,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error broadcasting message:', error);
    }
  }

  public invalidateQueries(queryKey?: QueryKey) {
    // Always invalidate locally first
    const refetchType = this.isLeader ? 'active' : 'none';
    if (queryKey) {
      this.queryClient.invalidateQueries({ queryKey, refetchType });
    } else {
      this.queryClient.invalidateQueries({ refetchType });
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

  public requestSubscriptions(request: string[] | RouteSubscriptionRequest) {
    const routeRequest: RouteSubscriptionRequest = Array.isArray(request)
      ? {
          routeKey: `delegated:${this.tabId}`,
          subscriptions: request.map((table) => ({
            table,
            queryKey: [table],
            priority: 'medium',
          })),
        }
      : request;

    if (this.isLeader) {
      this.handleSubscriptionRequest({
        requesterTabId: this.tabId,
        routeKey: routeRequest.routeKey,
        subscriptions: routeRequest.subscriptions,
      });
      return;
    }

    // If we're a follower, request the leader to handle subscriptions
    this.broadcast({
      type: 'subscription-request',
      routeKey: routeRequest.routeKey,
      subscriptions: routeRequest.subscriptions,
      tables: routeRequest.subscriptions.map((subscription) => subscription.table),
      tabId: this.tabId
    });
  }

  public releaseSubscriptions(routeKey: string) {
    if (this.isLeader) {
      this.handleSubscriptionRelease(routeKey, this.tabId);
      return;
    }

    this.broadcast({
      type: 'subscription-release',
      routeKey,
      tabId: this.tabId,
    });
  }

  private clearIdentityState() {
    this.scopeRevision += 1;
    this.becomeFollower();
    this.pauseIntervals();
    this.releaseLeaderLock?.();
    this.releaseLeaderLock = null;
    this.lockAcquired = false;
    if (this.broadcastFlushTimeout) clearTimeout(this.broadcastFlushTimeout);
    this.broadcastFlushTimeout = null;
    this.pendingBroadcasts.clear();
    this.lastBroadcastedUpdatedAt.clear();
    if (this.delegatedOwners.size > 0) {
      const manager = UnifiedSubscriptionManager.getInstance(this.queryClient);
      this.delegatedOwners.forEach((owner) => manager.cleanupRouteDependentSubscriptions(owner));
      this.delegatedOwners.clear();
    }
    try {
      const leaderInfo = localStorage.getItem(this.leaderKey);
      if (leaderInfo) {
        if (JSON.parse(leaderInfo).tabId === this.tabId) localStorage.removeItem(this.leaderKey);
      }
    } catch { /* Storage may be unavailable; Web Locks do not depend on it. */ }
  }

  private resetForIdentity() {
    if (this.destroyed) return;
    // This also clears a buffered message when A logs out and back into A.
    this.clearIdentityState();
    this.broadcastChannel.close();
    this.scopeKey = currentScopeKey();
    this.lastLeaderSeen = Date.now();
    this.broadcastChannel = new BroadcastChannel(this.channelName);
    this.setupBroadcastChannel();
    void this.startLeaderElection();
  }

  public destroy() {
    if (this.destroyed) return;
    this.clearIdentityState();
    this.destroyed = true;
    this.scopeUnsubscribe?.();
    this.scopeUnsubscribe = null;
    if (this.leaderElectionInterval) {
      clearInterval(this.leaderElectionInterval);
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.visibilityUnsubscribe) {
      this.visibilityUnsubscribe();
      this.visibilityUnsubscribe = null;
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
      const leaderInfo = localStorage.getItem(this.leaderKey);
      if (leaderInfo) {
        try {
          const { tabId } = JSON.parse(leaderInfo);
          if (tabId === this.tabId) {
            localStorage.removeItem(this.leaderKey);
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
    requestSubscriptions: coordinator.requestSubscriptions.bind(coordinator),
    releaseSubscriptions: coordinator.releaseSubscriptions.bind(coordinator)
  };
}
