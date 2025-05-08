
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectionManager } from '@/lib/connection-manager';
import { toast } from 'sonner';

/**
 * Hook for resetting all subscriptions when encountering issues
 * Uses the ConnectionManager for a coordinated reset approach
 */
export function useResetSubscriptions() {
  const [isResetting, setIsResetting] = useState(false);
  const queryClient = useQueryClient();
  
  const resetAllSubscriptions = async () => {
    setIsResetting(true);
    try {
      console.log('Resetting all subscriptions...');
      
      // Use the connection manager to validate all connections
      connectionManager.validateConnections(true);
      
      // Invalidate all queries to refresh data after resetting subscriptions
      await queryClient.invalidateQueries();
      
      console.log('All subscriptions reset successfully');
      toast.success('Real-time connections have been reset');
    } catch (error) {
      console.error('Error resetting subscriptions:', error);
      toast.error('Failed to reset connections');
      throw error;
    } finally {
      setIsResetting(false);
    }
  };
  
  return {
    resetAllSubscriptions,
    isResetting
  };
}
