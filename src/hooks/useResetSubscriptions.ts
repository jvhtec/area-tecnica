
import { useCallback } from 'react';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Hook to provide methods for resetting and managing subscriptions
 */
export function useResetSubscriptions() {
  const { refreshSubscriptions, connectionStatus } = useSubscriptionContext();
  const queryClient = useQueryClient();
  
  /**
   * Reset all subscriptions and invalidate queries
   */
  const resetAllSubscriptions = useCallback(() => {
    try {
      console.log('Resetting all subscriptions');
      refreshSubscriptions();
      queryClient.invalidateQueries();
      toast.success('Real-time subscriptions have been reset');
    } catch (error) {
      console.error('Error resetting subscriptions:', error);
      toast.error('Failed to reset subscriptions');
    }
  }, [refreshSubscriptions, queryClient]);
  
  /**
   * Reset subscriptions for specific tables and invalidate corresponding queries
   */
  const resetTableSubscriptions = useCallback((tables: string[]) => {
    try {
      console.log('Resetting subscriptions for tables:', tables);
      refreshSubscriptions();
      
      // Invalidate queries for the specific tables
      tables.forEach(table => {
        queryClient.invalidateQueries({ queryKey: [table] });
      });
      
      toast.success('Table subscriptions have been reset');
    } catch (error) {
      console.error('Error resetting table subscriptions:', error);
      toast.error('Failed to reset table subscriptions');
    }
  }, [refreshSubscriptions, queryClient]);
  
  return {
    resetAllSubscriptions,
    resetTableSubscriptions,
    connectionStatus
  };
}
