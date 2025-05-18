
import { useParams } from 'react-router-dom';
import { useFestival } from '@/hooks/useFestival';
import { TimeoutLoader } from '@/components/ui/timeout-loader';
import { FestivalManagement } from './FestivalManagement';
import { useEffect } from 'react';
import { ensureRealtimeConnection } from '@/lib/enhanced-supabase-client';

export function FestivalManagementWrapper() {
  const { festivalId } = useParams<{ festivalId: string }>();
  
  const { 
    festival, 
    isLoading, 
    isError, 
    error, 
    refetch,
    isPaused,
    retryCount,
    maxRetries
  } = useFestival(festivalId || '');

  // Try to recover connection if we're in an error state
  useEffect(() => {
    if (isError || isPaused) {
      console.log('Festival fetch failed, attempting to recover connection');
      ensureRealtimeConnection().then(recovered => {
        if (recovered) {
          console.log('Connection recovered, retrying fetch');
          refetch();
        }
      });
    }
  }, [isError, isPaused, refetch]);

  return (
    <div>
      <TimeoutLoader
        isLoading={isLoading}
        isError={isError || retryCount >= maxRetries}
        error={error instanceof Error ? error : new Error('Failed to load festival')}
        message="Loading festival details..."
        onRetry={refetch}
        timeout={5000}
      />
      
      {!isLoading && !isError && festival && (
        <FestivalManagement festival={festival} />
      )}
    </div>
  );
}
