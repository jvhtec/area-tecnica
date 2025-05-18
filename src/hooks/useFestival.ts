
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/enhanced-supabase-client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export type Festival = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location?: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  status?: string;
};

/**
 * Enhanced festival hook with improved error handling and retry mechanisms
 */
export function useFestival(festivalId: string) {
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  
  const fetchFestival = async () => {
    if (!festivalId) {
      throw new Error('Festival ID is required');
    }

    try {
      const { data, error } = await supabase
        .from('festivals')
        .select('*')
        .eq('id', festivalId)
        .single();

      if (error) {
        // Handle specific error types
        if (error.code === 'PGRST116') {
          throw new Error('Festival not found');
        } else if (error.code === 'JWT_INVALID') {
          // Token issue, trigger refresh
          window.dispatchEvent(new CustomEvent('token-refresh-needed'));
          throw new Error('Authentication error, please try again');
        } else {
          throw error;
        }
      }

      if (!data) {
        throw new Error('Festival not found');
      }

      return data as Festival;
    } catch (error: any) {
      console.error("Error fetching festival:", error);
      
      // Increment retry count for UI feedback
      setRetryCount(prev => prev + 1);
      
      throw new Error(`Failed to fetch festival: ${error.message}`);
    }
  };

  const { 
    data: festival, 
    isLoading, 
    isError, 
    error,
    refetch,
    isPaused,
  } = useQuery({
    queryKey: ['festival', festivalId],
    queryFn: fetchFestival,
    enabled: !!festivalId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: maxRetries,
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000),
  });

  // Subscribe to realtime changes for this festival
  useEffect(() => {
    if (!festivalId) return;

    console.log(`Setting up festival subscription for ${festivalId}`);

    const subscription = supabase
      .channel(`festival-${festivalId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'festivals',
        filter: `id=eq.${festivalId}`,
      }, (payload) => {
        console.log('Festival changed:', payload);
        refetch();
      })
      .subscribe((status) => {
        console.log(`Festival subscription status: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to festival updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to festival updates');
          // Retry subscription after delay
          setTimeout(() => {
            subscription.unsubscribe();
            // Re-setup subscription
            supabase
              .channel(`festival-${festivalId}-retry`)
              .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'festivals',
                filter: `id=eq.${festivalId}`,
              }, (payload) => {
                console.log('Festival changed (retry subscription):', payload);
                refetch();
              })
              .subscribe();
          }, 5000);
        }
      });

    return () => {
      console.log(`Cleaning up festival subscription for ${festivalId}`);
      subscription.unsubscribe();
    };
  }, [festivalId, refetch]);

  // Add automatic retry on network reconnection
  useEffect(() => {
    const handleConnectionRestored = () => {
      console.log('Connection restored, refetching festival data');
      refetch();
    };
    
    window.addEventListener('connection-restored', handleConnectionRestored);
    
    return () => {
      window.removeEventListener('connection-restored', handleConnectionRestored);
    };
  }, [refetch]);

  // Show retry toast when query is paused (network disconnected)
  useEffect(() => {
    if (isPaused) {
      toast.error('Network connection issue', {
        description: 'Trying to reconnect...',
        duration: 5000,
        action: {
          label: 'Retry',
          onClick: () => refetch(),
        },
      });
    }
  }, [isPaused, refetch]);

  return { 
    festival, 
    isLoading, 
    isError, 
    error, 
    refetch,
    isPaused,
    retryCount,
    maxRetries
  };
}
