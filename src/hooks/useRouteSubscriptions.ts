import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';

// Define subscription requirements for each route
const ROUTE_SUBSCRIPTIONS: Record<string, string[]> = {
  // Dashboard route needs these tables for real-time updates
  '/dashboard': ['jobs', 'job_assignments', 'job_date_types', 'messages', 'direct_messages'],
  
  // Other routes with their required tables
  '/calendar': ['jobs', 'job_departments'],
  '/technician-dashboard': ['jobs', 'job_assignments'],
  '/logistics': ['jobs', 'logistics_events'],
  '/inventory': ['equipment', 'stock_movements', 'global_stock_entries'],
  '/tours': ['tours', 'tour_dates'],
  
  // Add more routes as needed
  '/jobs': ['jobs'],
  '/job': ['jobs', 'job_assignments', 'job_departments'],
};

// Default tables that should be monitored on all routes
const GLOBAL_TABLES = ['profiles'];

/**
 * Hook to determine required subscriptions based on current route
 * and monitor their status
 */
export function useRouteSubscriptions() {
  const location = useLocation();
  const { subscriptionsByTable, connectionStatus, lastRefreshTime } = useSubscriptionContext();
  const [status, setStatus] = useState({
    requiredTables: [] as string[],
    subscribedTables: [] as string[],
    unsubscribedTables: [] as string[],
    isFullySubscribed: false,
    isStale: false,
    routeKey: '',
  });

  // Determine relevant subscriptions based on current route
  useEffect(() => {
    const pathname = location.pathname;
    
    // Find the most specific route match
    let routeKey = Object.keys(ROUTE_SUBSCRIPTIONS)
      .filter(route => pathname.startsWith(route))
      .sort((a, b) => b.length - a.length)[0]; // Sort by length to get most specific
    
    // If no match, use dashboard as default
    if (!routeKey) {
      routeKey = '/dashboard';
    }
    
    // Get required tables for this route
    const routeTables = ROUTE_SUBSCRIPTIONS[routeKey] || [];
    
    // Combine with global tables
    const requiredTables = [...new Set([...GLOBAL_TABLES, ...routeTables])];
    
    // Determine which are subscribed vs unsubscribed
    const subscribedTables = requiredTables.filter(
      table => subscriptionsByTable[table]?.length > 0
    );
    
    const unsubscribedTables = requiredTables.filter(
      table => !subscriptionsByTable[table] || subscriptionsByTable[table].length === 0
    );
    
    // Check if all required tables are subscribed
    const isFullySubscribed = unsubscribedTables.length === 0 && requiredTables.length > 0;
    
    // Check if data is stale (older than 5 minutes)
    const isStale = Date.now() - lastRefreshTime > 5 * 60 * 1000;
    
    setStatus({
      requiredTables,
      subscribedTables,
      unsubscribedTables,
      isFullySubscribed,
      isStale,
      routeKey,
    });
  }, [location.pathname, subscriptionsByTable, lastRefreshTime]);

  return {
    ...status,
    connectionStatus,
    lastRefreshTime,
  };
}
