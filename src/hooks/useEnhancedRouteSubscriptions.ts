
import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { MultiTabCoordinator } from '@/lib/multitab-coordinator';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { isAdminRole } from '@/utils/permissions';
import {
  GLOBAL_SUBSCRIPTION_TABLES,
  getSubscriptionConfigForPathname,
} from '@/routes/app-route-manifest';

export { ROUTE_SUBSCRIPTIONS } from '@/routes/app-route-manifest';

const ROUTE_QUERY_KEY_OVERRIDES: Record<string, string | string[]> = {
  jobs: ['optimized-jobs'],
  job_assignments: ['optimized-jobs'],
  job_departments: ['optimized-jobs'],
  job_documents: ['optimized-jobs'],
  flex_folders: ['optimized-jobs'],
  locations: ['optimized-jobs'],
  tour_timeline_events: ['tour-ops'],
  tour_travel_segments: ['tour-ops'],
  tour_accommodations: ['tour-ops'],
  tour_documents: ['tour-ops', 'tour-documents'],
  tour_guest_links: ['tour-guest-links'],
  hoja_de_ruta: ['tour-ops', 'hoja_de_ruta'],
  hoja_de_ruta_travel_arrangements: ['tour-ops', 'hoja_de_ruta'],
  hoja_de_ruta_accommodations: ['tour-ops', 'hoja_de_ruta'],
  hoja_de_ruta_room_assignments: ['tour-ops', 'hoja_de_ruta'],
  hoja_de_ruta_staff: ['tour-ops', 'hoja_de_ruta'],
  hoja_de_ruta_transport: ['tour-ops', 'hoja_de_ruta'],
  job_date_types: ['date-types'],
  messages: ['messages'],
  direct_messages: ['direct_messages'],
};

const getRouteQueryKeyForTable = (table: string): string | string[] =>
  ROUTE_QUERY_KEY_OVERRIDES[table] ?? [table];

// Maximum time (in milliseconds) that a subscription can be idle before it's considered stale
const SUBSCRIPTION_STALE_TIME = 5 * 60 * 1000; // 5 minutes
// Inactivity threshold after which subscriptions should be refreshed when the page becomes active
const INACTIVITY_THRESHOLD = 3 * 60 * 1000; // 3 minutes

/**
 * Enhanced hook to determine required subscriptions based on current route
 * and monitor their status with intelligent cleanup
 */
export function useEnhancedRouteSubscriptions() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { lastRefreshTime, connectionStatus } = useSubscriptionContext();
  const { userRole } = useOptimizedAuth();
  const isAdmin = isAdminRole(userRole);
  const manager = UnifiedSubscriptionManager.getInstance(queryClient);
  const lastActiveTimestamp = useRef<number>(Date.now());
  const wasInactive = useRef<boolean>(false);
  const currentRouteKey = useRef<string | null>(null);
  const multiTabCoordinator = MultiTabCoordinator.getInstance(queryClient);
  const [isLeader, setIsLeader] = useState(true);

  const [status, setStatus] = useState({
    requiredTables: [] as string[],
    subscribedTables: [] as string[],
    unsubscribedTables: [] as string[],
    isFullySubscribed: false,
    isStale: false,
    routeKey: '',
    formattedLastActivity: ''
  });

  // Listen for tab role changes
  useEffect(() => {
    const handleTabRoleChange = (event: CustomEvent) => {
      setIsLeader(event.detail.isLeader);
    };
    
    window.addEventListener('tab-leader-elected', handleTabRoleChange as EventListener);
    
    return () => {
      window.removeEventListener('tab-leader-elected', handleTabRoleChange as EventListener);
    };
  }, []);

  useEffect(() => {
    return () => {
      const routeKey = currentRouteKey.current;
      if (routeKey) {
        manager.cleanupRouteDependentSubscriptions(routeKey);
        currentRouteKey.current = null;
      }
    };
  }, [manager]);

  // Check document visibility changes to detect when the user returns to the page (only for leader)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const now = Date.now();
      
      if (document.visibilityState === 'visible' && isLeader) {
        // Calculate time since last activity
        const timeSinceLastActive = now - lastActiveTimestamp.current;
        
        // If the page was inactive for longer than the threshold, refresh subscriptions
        if (timeSinceLastActive > INACTIVITY_THRESHOLD) {
          wasInactive.current = true;
          console.log(`Page was inactive for ${timeSinceLastActive}ms, refreshing subscriptions`);
          
          // Force refresh all subscriptions
          const tableNames = [...status.requiredTables];
          if (tableNames.length > 0) {
            manager.forceRefreshSubscriptions(tableNames);
            multiTabCoordinator.invalidateQueries();
            
            toast.info("Refreshing data after inactivity", {
              description: "Reconnecting to real-time updates..."
            });
          }
        }
        
        // Update the last active timestamp
        lastActiveTimestamp.current = now;
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [manager, queryClient, status.requiredTables, isLeader, multiTabCoordinator]);

  // Subscribe to required tables for the current route
  useEffect(() => {
    // Reset inactivity state on route change
    wasInactive.current = false;
    lastActiveTimestamp.current = Date.now();
    
    const pathname = location.pathname;
    const { routeKey, tables: routeTables } = getSubscriptionConfigForPathname(pathname);
    const previousRouteKey = currentRouteKey.current;
    
    console.log('Configuring subscriptions for route:', pathname);
    console.log('Using route key for subscriptions:', routeKey);
    
    // Clean up subscriptions from previous routes
    if (previousRouteKey && previousRouteKey !== routeKey) {
      manager.cleanupRouteDependentSubscriptions(previousRouteKey);
    }
    currentRouteKey.current = routeKey;
    
    if (routeTables.length === 0) {
      console.log(`No subscription config found for route ${routeKey}, using global tables only`);
    }
    
    // Combine with global tables, ensuring no duplicates
    const allTables = GLOBAL_SUBSCRIPTION_TABLES.map((tableInfo) => ({ ...tableInfo }));
    
    routeTables.forEach(tableInfo => {
      if (!allTables.some(t => t.table === tableInfo.table)) {
        allTables.push({ ...tableInfo });
      } else {
        // If the table exists but with a lower priority, update it to the higher priority
        const existingIndex = allTables.findIndex(t => t.table === tableInfo.table);
        if (existingIndex >= 0) {
          const existingPriority = allTables[existingIndex].priority;
          if (getPriorityValue(tableInfo.priority) > getPriorityValue(existingPriority)) {
            allTables[existingIndex].priority = tableInfo.priority;
          }
        }
      }
    });
    
    // Subscribe to all tables (only if we're the leader)
    if (isLeader) {
      allTables.forEach(({ table, priority }) => {
        console.log(`Subscribing to ${table} with priority ${priority}`);
        const queryKey = getRouteQueryKeyForTable(table);
        const subscription = manager.subscribeToTable(table, queryKey, undefined, priority);
        manager.registerRouteSubscription(routeKey, subscription.key);
      });
    } else {
      // If we're a follower, request the leader to handle subscriptions
      const tableNames = allTables.map(t => t.table);
      multiTabCoordinator.requestSubscriptions(tableNames);
    }
    
    // Update the local state with table information
    const tableNames = allTables.map(t => t.table);
    
    const subscriptionsByTable = manager.getSubscriptionsByTable();
    const subscribedTables = tableNames.filter(
      table => subscriptionsByTable[table]?.length > 0
    );
    
    const unsubscribedTables = tableNames.filter(
      table => !subscriptionsByTable[table] || subscriptionsByTable[table].length === 0
    );
    
    const isFullySubscribed = unsubscribedTables.length === 0 && tableNames.length > 0;
    
    // Format last activity time
    let formattedLastActivity = "Unknown";
    try {
      formattedLastActivity = formatDistanceToNow(lastRefreshTime, { addSuffix: true });
    } catch (error) {
      console.error("Error formatting time:", error);
    }
    
    const isStale = Date.now() - lastRefreshTime > SUBSCRIPTION_STALE_TIME;
    
    setStatus({
      requiredTables: tableNames,
      subscribedTables,
      unsubscribedTables,
      isFullySubscribed,
      isStale,
      routeKey,
      formattedLastActivity
    });
    
  }, [location.pathname, manager, lastRefreshTime, queryClient, isLeader, multiTabCoordinator]);

  // Helper to get priority value for comparison
  function getPriorityValue(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  return {
    ...status,
    connectionStatus,
    lastRefreshTime,
    wasInactive: wasInactive.current,
    forceRefresh: () => {
      if (status.requiredTables.length > 0) {
        console.log('Manually forcing refresh of all subscriptions');
        if (isLeader) {
          manager.forceRefreshSubscriptions(status.requiredTables);
          multiTabCoordinator.invalidateQueries();
          // Only show toasts to admin users
          if (isAdmin) {
            toast.success('Subscriptions refreshed');
          }
        } else {
          // Followers can request refresh from leader
          multiTabCoordinator.requestSubscriptions(status.requiredTables);
        }
        wasInactive.current = false;
      }
    }
  };
}
