
import { useParams } from 'react-router-dom';
import { useFestival } from '@/hooks/useFestival';
import { TimeoutLoader } from '@/components/ui/timeout-loader';
import { FestivalManagement } from './FestivalManagement';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';

export function FestivalManagementWrapper() {
  const { festivalId } = useParams<{ festivalId: string }>();
  const { status: connectionStatus, recoverConnection } = useConnectionStatus();
  
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
      
      const attemptRecovery = async () => {
        // Full connection recovery
        console.log('Attempting full recovery');
        const fullRecoverySuccess = await recoverConnection();
        
        if (fullRecoverySuccess) {
          console.log('Full connection recovery succeeded, retrying fetch');
          refetch();
          toast.success('Connection restored');
        } else {
          console.log('All recovery attempts failed');
          toast.error('Connection issues persist', {
            description: 'Please check your network connection and try again'
          });
        }
      };
      
      attemptRecovery();
    }
  }, [isError, isPaused, refetch, recoverConnection]);

  const handleRetry = async () => {
    toast.info('Reconnecting...');
    
    try {
      await recoverConnection();
      await refetch();
    } catch (error) {
      console.error('Error during retry:', error);
      toast.error('Retry failed');
    }
  };

  if (isLoading) {
    return (
      <TimeoutLoader
        isLoading={isLoading}
        isError={false}
        message="Loading festival details..."
        timeout={5000}
      />
    );
  }

  if (isError || retryCount >= maxRetries) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] max-w-md mx-auto text-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Error Loading Festival</h2>
        <p className="text-muted-foreground mt-2 mb-4">
          {error instanceof Error ? error.message : 'Failed to load festival data'}
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Connection status: {connectionStatus}
        </p>
        <Button 
          onClick={handleRetry} 
          variant="default"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reconnect & Retry
        </Button>
      </div>
    );
  }

  if (!festival) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <h2 className="text-xl font-bold">Festival Not Found</h2>
        <p className="text-muted-foreground mt-2">
          The requested festival could not be found or may have been deleted.
        </p>
      </div>
    );
  }

  return <FestivalManagement festival={festival} />;
}
