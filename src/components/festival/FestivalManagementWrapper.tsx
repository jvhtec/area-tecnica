
import React from 'react';
import { useParams } from 'react-router-dom';
import { useFestival } from '@/hooks/useFestival';
import { TimeoutLoader } from '@/components/ui/timeout-loader';
import { FestivalManagement } from './FestivalManagement';
import { ConnectionIndicator } from '@/components/ui/connection-indicator';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';
import { useQueryClient } from '@tanstack/react-query';

export function FestivalManagementWrapper() {
  const { festivalId } = useParams<{ festivalId: string }>();
  const queryClient = useQueryClient();
  
  // Get festival data with the hook
  const { 
    festival, 
    isLoading, 
    isError, 
    error,
    refetch
  } = useFestival(festivalId || '');

  // Handler for the retry button
  const handleRetry = async () => {
    // First try to reestablish connections
    const manager = UnifiedSubscriptionManager.getInstance(queryClient);
    manager.reestablishSubscriptions();
    
    // Then refetch the data
    return refetch();
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-end mb-4">
        <ConnectionIndicator variant="badge" />
      </div>
      
      <TimeoutLoader 
        isLoading={isLoading} 
        timeout={10000} // 10 seconds
        message="Loading festival data is taking longer than expected. This may be due to network issues or the server being busy."
        onRetry={handleRetry}
      >
        {isError ? (
          <div className="p-8 text-center">
            <p className="text-red-500 mb-4">Error loading festival data</p>
            <pre className="text-sm text-muted-foreground">{error?.message}</pre>
          </div>
        ) : festival ? (
          <FestivalManagement festival={festival} />
        ) : (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">No festival found</p>
          </div>
        )}
      </TimeoutLoader>
    </div>
  );
}
