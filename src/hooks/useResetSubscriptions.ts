
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';

export function useResetSubscriptions() {
  const [isResetting, setIsResetting] = useState(false);
  const queryClient = useQueryClient();
  
  const resetAllSubscriptions = async () => {
    setIsResetting(true);
    try {
      console.log('Resetting all subscriptions...');
      const manager = UnifiedSubscriptionManager.getInstance(queryClient);
      manager.reestablishSubscriptions();
      manager.markRefreshed();
      
      // Invalidate all queries to refresh data after resetting subscriptions
      await queryClient.invalidateQueries();
      console.log('All subscriptions reset successfully');
    } catch (error) {
      console.error('Error resetting subscriptions:', error);
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
