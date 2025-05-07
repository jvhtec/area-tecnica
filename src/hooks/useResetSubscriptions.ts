
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EnhancedSubscriptionManager } from '@/lib/enhanced-subscription-manager';

export function useResetSubscriptions() {
  const [isResetting, setIsResetting] = useState(false);
  const queryClient = useQueryClient();
  
  const resetAllSubscriptions = async () => {
    setIsResetting(true);
    try {
      console.log('Resetting all subscriptions...');
      const manager = EnhancedSubscriptionManager.getInstance(queryClient);
      manager.resetAllSubscriptions();
      
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
