
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TimeoutLoader } from '@/components/ui/timeout-loader';
import { useEffect } from 'react';
import { ensureRealtimeConnection } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';

interface Tour {
  id: string;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  color: string;
  flex_folders_created: boolean;
  created_by?: string;
  created_at: string;
}

interface TourManagementWrapperProps {
  children: (tour: Tour) => React.ReactNode;
}

export function TourManagementWrapper({ children }: TourManagementWrapperProps) {
  const { tourId } = useParams<{ tourId: string }>();
  const { status: connectionStatus, recoverConnection } = useConnectionStatus();
  
  const { 
    data: tour, 
    isLoading, 
    isError, 
    error, 
    refetch,
    isPaused,
    retryCount,
    maxRetries = 3
  } = useQuery({
    queryKey: ['tour', tourId],
    queryFn: async () => {
      if (!tourId) throw new Error('Tour ID is required');

      console.log('Fetching tour details for:', tourId);
      
      const { data, error } = await supabase
        .from('tours')
        .select('*')
        .eq('id', tourId)
        .eq('deleted', false)
        .single();

      if (error) {
        console.error('Error fetching tour:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Tour not found');
      }

      console.log('Tour fetched successfully:', data);
      return data as Tour;
    },
    enabled: !!tourId,
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Try to recover connection if we're in an error state
  useEffect(() => {
    if (isError || isPaused) {
      console.log('Tour fetch failed, attempting to recover connection');
      
      const attemptRecovery = async () => {
        // First try simple realtime reconnection
        const recovered = await ensureRealtimeConnection();
        
        if (recovered) {
          console.log('Connection recovered with ensureRealtimeConnection, retrying fetch');
          refetch();
        } else {
          // If that fails, try full connection recovery
          console.log('Simple reconnection failed, attempting full recovery');
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
        message="Loading tour details..."
        timeout={5000}
      />
    );
  }

  if (isError || retryCount >= maxRetries) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] max-w-md mx-auto text-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Error Loading Tour</h2>
        <p className="text-muted-foreground mt-2 mb-4">
          {error instanceof Error ? error.message : 'Failed to load tour data'}
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

  if (!tour) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <h2 className="text-xl font-bold">Tour Not Found</h2>
        <p className="text-muted-foreground mt-2">
          The requested tour could not be found or may have been deleted.
        </p>
      </div>
    );
  }

  return <>{children(tour)}</>;
}
