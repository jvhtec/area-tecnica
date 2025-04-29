
import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';
import { formatDistanceToNow } from 'date-fns';

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
  
  // Festival specific routes
  '/festivals': [
    { table: 'jobs', priority: 'high' }, 
    { table: 'festival_artists', priority: 'medium' }, 
    { table: 'festival_forms', priority: 'low' }
  ],
  '/festival-management': [
    { table: 'festivals', priority: 'high' }, 
    { table: 'festival_artists', priority: 'high' }, 
    { table: 'festival_forms', priority: 'medium' }
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

/**
 * Enhanced hook to determine required subscriptions based on current route
 * and monitor their status with intelligent cleanup
 */
export function useEnhancedRouteSubscriptions() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { lastRefreshTime, connectionStatus } = useSubscriptionContext();
  const manager = UnifiedSubscriptionManager.getInstance(queryClient);
  
  const [status, setStatus] = useState({
    requiredTables: [] as string[],
    subscribedTables: [] as string[],
    unsubscribedTables: [] as string[],
    isFullySubscribed: false,
    isStale: false,
    routeKey: '',
    formattedLastActivity: ''
  });

  // Find the most specific route match
  const findRoutePath = useCallback((pathname: string) => {
    // First try exact match
    if (ROUTE_SUBSCRIPTIONS[pathname]) {
      return pathname;
    }
    
    // If no exact match, find the most specific parent route
    return Object.keys(ROUTE_SUBSCRIPTIONS)
      .filter(route => pathname.startsWith(route))
      .sort((a, b) => b.length - a.length)[0] || pathname;
  }, []);

  // Subscribe to required tables for the current route
  useEffect(() => {
    const pathname = location.pathname;
    const routeKey = findRoutePath(pathname);
    
    // Clean up subscriptions from previous routes
    manager.cleanupRouteDependentSubscriptions(pathname);
    
    // Get required tables for this route
    const routeTables = ROUTE_SUBSCRIPTIONS[routeKey] || [];
    
    // Combine with global tables, ensuring no duplicates
    const allTables = [...GLOBAL_TABLES];
    
    routeTables.forEach(tableInfo => {
      if (!allTables.some(t => t.table === tableInfo.table)) {
        allTables.push(tableInfo);
      }
    });
    
    // Subscribe to all tables
    allTables.forEach(({ table, priority }) => {
      manager.subscribeToTable(table, table, undefined, priority);
      manager.registerRouteSubscription(pathname, `${table}::${table}`);
    });
    
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
    
    setStatus({
      requiredTables: tableNames,
      subscribedTables,
      unsubscribedTables,
      isFullySubscribed,
      isStale: Date.now() - lastRefreshTime > 5 * 60 * 1000, // 5 minutes
      routeKey,
      formattedLastActivity
    });
    
  }, [location.pathname, manager, findRoutePath, lastRefreshTime]);

  return {
    ...status,
    connectionStatus,
    lastRefreshTime,
  };
}

// Default tables that should be monitored on all routes
const GLOBAL_TABLES = [{ table: 'profiles', priority: 'medium' as const }];

