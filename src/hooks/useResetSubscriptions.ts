
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectionManager } from '@/lib/connection-manager';
import { toast } from 'sonner';
import { connectionConfig } from '@/lib/connection-config';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';

/**
 * Enhanced hook for resetting all subscriptions when encountering issues
 * Uses the ConnectionManager for a coordinated reset approach with improved
 * error handling, throttling, and user feedback
 */
export function useResetSubscriptions() {
  const [isResetting, setIsResetting] = useState(false);
  const queryClient = useQueryClient();
  const config = connectionConfig.get();
  
  // Track last reset time to prevent rapid consecutive resets
  const [lastResetTime, setLastResetTime] = useState<number>(0);
  
  const resetAllSubscriptions = useCallback(async () => {
    // Throttle resets to prevent rapid consecutive resets
    const now = Date.now();
    const timeSinceLastReset = now - lastResetTime;
    const minTimeBetweenResets = 5000; // 5 seconds minimum between resets
    
    if (timeSinceLastReset < minTimeBetweenResets) {
      const timeToWait = Math.ceil((minTimeBetweenResets - timeSinceLastReset) / 1000);
      toast.warning(`Please wait ${timeToWait}s before resetting again`);
      return false;
    }
    
    setIsResetting(true);
    setLastResetTime(now);
    
    try {
      console.log('Resetting all subscriptions...');
      
      // 1. Use the connection manager to validate all connections
      connectionManager.validateConnections(true);
      
      // 2. Also use the UnifiedSubscriptionManager to reestablish subscriptions
      const manager = UnifiedSubscriptionManager.getInstance(queryClient);
      if (typeof manager.reestablishAllSubscriptions === 'function') {
        manager.reestablishAllSubscriptions();
      }
      
      // 3. Invalidate all queries to refresh data after resetting subscriptions
      await queryClient.invalidateQueries();
      
      console.log('All subscriptions reset successfully');
      
      if (config.showReconnectNotifications && !config.quietMode) {
        toast.success('Real-time connections have been reset');
      }
      
      return true;
    } catch (error) {
      console.error('Error resetting subscriptions:', error);
      toast.error('Failed to reset connections');
      throw error;
    } finally {
      setIsResetting(false);
    }
  }, [lastResetTime, queryClient]);
  
  /**
   * Reset specific tables only
   */
  const resetTableSubscriptions = useCallback(async (tables: string[]) => {
    if (!tables || tables.length === 0) {
      return resetAllSubscriptions();
    }
    
    setIsResetting(true);
    try {
      console.log(`Resetting subscriptions for tables: ${tables.join(', ')}`);
      
      // Use UnifiedSubscriptionManager to refresh specific tables
      const manager = UnifiedSubscriptionManager.getInstance(queryClient);
      
      if (typeof manager.forceRefreshSubscriptions === 'function') {
        manager.forceRefreshSubscriptions(tables);
      } else {
        // Fallback to full reset if the method is not available
        connectionManager.validateConnections(true);
      }
      
      // Invalidate queries for the affected tables
      for (const table of tables) {
        await queryClient.invalidateQueries({ queryKey: [table] });
      }
      
      console.log('Table subscriptions reset successfully');
      if (config.showReconnectNotifications && !config.quietMode) {
        toast.success('Table subscriptions have been reset');
      }
      
      return true;
    } catch (error) {
      console.error('Error resetting table subscriptions:', error);
      toast.error('Failed to reset table subscriptions');
      throw error;
    } finally {
      setIsResetting(false);
    }
  }, [queryClient, resetAllSubscriptions]);
  
  return {
    resetAllSubscriptions,
    resetTableSubscriptions,
    isResetting
  };
}
