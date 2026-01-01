
import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { MultiTabCoordinator } from '@/lib/multitab-coordinator';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';

// Define subscription requirements for each route
export const ROUTE_SUBSCRIPTIONS: Record<string, Array<{
  table: string,
  priority: 'high' | 'medium' | 'low'
}>> = {
  // Dashboard route needs these tables for real-time updates
  '/dashboard': [
    { table: 'jobs', priority: 'high' }, 
    { table: 'job_assignments', priority: 'high' }, 
    { table: 'job_date_types', priority: 'medium' }, 
    { table: 'messages', priority: 'medium' }, 
    { table: 'direct_messages', priority: 'medium' }
  ],
  
  // Department-specific routes
  '/sound': [
    { table: 'jobs', priority: 'high' }, 
    { table: 'job_assignments', priority: 'high' }, 
    { table: 'job_departments', priority: 'medium' }
  ],
  '/lights': [
    { table: 'jobs', priority: 'high' }, 
    { table: 'job_assignments', priority: 'high' }, 
    { table: 'job_departments', priority: 'medium' }
  ],
  '/video': [
    { table: 'jobs', priority: 'high' }, 
    { table: 'job_assignments', priority: 'high' }, 
    { table: 'job_departments', priority: 'medium' }
  ],
  
  // Other routes with their required tables
  '/calendar': [
    { table: 'jobs', priority: 'high' }, 
    { table: 'job_departments', priority: 'medium' }
  ],
  '/technician-dashboard': [
    { table: 'jobs', priority: 'high' }, 
    { table: 'job_assignments', priority: 'high' }
  ],
  '/logistics': [
    { table: 'jobs', priority: 'high' }, 
    { table: 'logistics_events', priority: 'high' }
  ],
  '/inventory': [
    { table: 'equipment', priority: 'high' }, 
    { table: 'stock_movements', priority: 'high' }, 
    { table: 'global_stock_entries', priority: 'medium' }
  ],
  '/tours': [
    { table: 'tours', priority: 'high' }, 
    { table: 'tour_dates', priority: 'medium' }
  ],
  '/project-management': [
    { table: 'jobs', priority: 'high' },
    { table: 'job_assignments', priority: 'medium' },
    { table: 'job_departments', priority: 'medium' }
  ],
  '/management/rates': [
    { table: 'rate_cards_tour_2025', priority: 'high' },
    { table: 'rate_extras_2025', priority: 'high' },
    { table: 'custom_tech_rates', priority: 'high' },
    { table: 'timesheets', priority: 'high' },
    { table: 'tours', priority: 'medium' },
    { table: 'jobs', priority: 'medium' },
    { table: 'job_assignments', priority: 'medium' }
  ],
  '/gastos': [
    { table: 'job_expenses', priority: 'high' },
    { table: 'expense_permissions', priority: 'medium' },
    { table: 'expense_categories', priority: 'low' }
  ],
  
  // Festival specific routes
  '/festivals': [
    { table: 'jobs', priority: 'high' }, 
    { table: 'festival_artists', priority: 'medium' }, 
    { table: 'festival_forms', priority: 'low' }
  ],
  '/festival-management': [
    { table: 'festivals', priority: 'high' }, 
    { table: 'festival_artists', priority: 'high' }, 
    { table: 'festival_forms', priority: 'medium' },
    { table: 'festival_shifts', priority: 'medium' },
    { table: 'festival_shift_assignments', priority: 'medium' },
    { table: 'festival_gear_setups', priority: 'medium' }
  ],
  '/festival-management/artists': [
    { table: 'festivals', priority: 'high' }, 
    { table: 'festival_artists', priority: 'high' }, 
    { table: 'festival_forms', priority: 'high' }
  ],
  '/festival-management/gear': [
    { table: 'festivals', priority: 'high' }, 
    { table: 'festival_gear', priority: 'high' },
    { table: 'festival_gear_setups', priority: 'high' }
  ],
  '/festival-management/scheduling': [
    { table: 'festivals', priority: 'high' },
    { table: 'festival_shifts', priority: 'high' },
    { table: 'festival_shift_assignments', priority: 'high' },
    { table: 'profiles', priority: 'medium' }
  ],
  '/festival-artist-management': [
    { table: 'festivals', priority: 'high' }, 
    { table: 'festival_artists', priority: 'high' }, 
    { table: 'festival_forms', priority: 'high' }
  ],
  '/festival-gear-management': [
    { table: 'festivals', priority: 'high' }, 
    { table: 'festival_gear', priority: 'high' }
  ],
  
  // Tool specific routes
  '/pesos-tool': [
    { table: 'jobs', priority: 'high' },
    { table: 'video_memoria_tecnica_documents', priority: 'high' }
  ],
  '/consumos-tool': [
    { table: 'jobs', priority: 'high' },
    { table: 'power_requirement_tables', priority: 'high' }
  ],
  '/memoria-tecnica-tool': [
    { table: 'jobs', priority: 'high' },
    { table: 'memoria_tecnica_documents', priority: 'high' }
  ],
  
  // Add more routes as needed
  '/jobs': [{ table: 'jobs', priority: 'high' }],
  '/job': [
    { table: 'jobs', priority: 'high' }, 
    { table: 'job_assignments', priority: 'high' }, 
    { table: 'job_departments', priority: 'medium' }
  ],
  '/settings': [{ table: 'profiles', priority: 'medium' }],
  '/profile': [{ table: 'profiles', priority: 'high' }],
  '/users': [{ table: 'profiles', priority: 'high' }],
  '/users-management': [{ table: 'profiles', priority: 'high' }],
  '/hoja-de-ruta': [
    { table: 'jobs', priority: 'high' }, 
    { table: 'job_departments', priority: 'medium' }
  ],
  '/labor-po-form': [
    { table: 'jobs', priority: 'high' }, 
    { table: 'job_departments', priority: 'medium' }
  ],
};

// Default tables that should be monitored on all routes
const GLOBAL_TABLES: Array<{ table: string, priority: 'high' | 'medium' | 'low' }> = [
  { table: 'profiles', priority: 'medium' }
];

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
  const isAdmin = userRole === 'admin';
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

  // Find the most specific route match
  const findRoutePath = useCallback((pathname: string) => {
    // First check if we have an exact match
    if (ROUTE_SUBSCRIPTIONS[pathname]) {
      return pathname;
    }
    
    // Handle dynamic routes for festival management
    if (pathname.includes('/festival-management/')) {
      // Extract the base path and check for specific sub-routes
      if (pathname.includes('/artists')) {
        return '/festival-management/artists';
      } else if (pathname.includes('/gear')) {
        return '/festival-management/gear';
      } else if (pathname.includes('/scheduling')) {
        return '/festival-management/scheduling';
      } else {
        return '/festival-management'; // Default festival management route
      }
    }
    
    // Handle dynamic routes for tool pages
    if (pathname.includes('/pesos-tool')) {
      return '/pesos-tool';
    }
    if (pathname.includes('/consumos-tool')) {
      return '/consumos-tool';
    }
    if (pathname.includes('/memoria-tecnica-tool')) {
      return '/memoria-tecnica-tool';
    }
    
    // If no exact match, find the most specific parent route
    return Object.keys(ROUTE_SUBSCRIPTIONS)
      .filter(route => pathname.startsWith(route))
      .sort((a, b) => b.length - a.length)[0] || pathname;
  }, []);
  
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
    const routeKey = findRoutePath(pathname);
    const previousRouteKey = currentRouteKey.current;
    
    console.log('Configuring subscriptions for route:', pathname);
    console.log('Using route key for subscriptions:', routeKey);
    
    // Clean up subscriptions from previous routes
    if (previousRouteKey && previousRouteKey !== routeKey) {
      manager.cleanupRouteDependentSubscriptions(previousRouteKey);
    }
    currentRouteKey.current = routeKey;
    
    // Get required tables for this route
    const routeTables = ROUTE_SUBSCRIPTIONS[routeKey] || [];
    
    if (routeTables.length === 0) {
      console.log(`No subscription config found for route ${routeKey}, using global tables only`);
    }
    
    // Combine with global tables, ensuring no duplicates
    const allTables = [...GLOBAL_TABLES];
    
    routeTables.forEach(tableInfo => {
      if (!allTables.some(t => t.table === tableInfo.table)) {
        allTables.push(tableInfo);
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
        const subscription = manager.subscribeToTable(table, table, undefined, priority);
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
    
  }, [location.pathname, manager, findRoutePath, lastRefreshTime, queryClient, isLeader, multiTabCoordinator]);

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
