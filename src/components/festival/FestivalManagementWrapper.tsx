
import { useParams } from 'react-router-dom';
import { useFestival } from '@/hooks/useFestival';
import { TimeoutLoader } from '@/components/ui/timeout-loader';
import { FestivalManagement } from './FestivalManagement';

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
