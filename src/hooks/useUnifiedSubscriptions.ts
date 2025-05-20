
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';

/**
 * Hook for managing multiple table subscriptions with a unified interface
 */
export const useUnifiedSubscriptions = (tables: string[], queryKey: string | string[]) => {
  const queryClient = useQueryClient();
  const subscriptionManager = UnifiedSubscriptionManager.getInstance(queryClient);
  
  useEffect(() => {
    console.log(`Setting up subscriptions for ${tables.join(', ')} with query key ${Array.isArray(queryKey) ? queryKey.join('/') : queryKey}`);
    
    // Subscribe to all tables
    const subscriptions = tables.map(table => 
      subscriptionManager.subscribeToTable({
        table,
        schema: 'public',
        event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
        queryKey: queryKey
      })
    );
    
    // Clean up subscriptions on unmount
    return () => {
      subscriptions.forEach(sub => {
        if (typeof sub.unsubscribe === 'function') {
          sub.unsubscribe();
        }
      });
      console.log(`Cleaned up subscriptions for ${tables.join(', ')}`);
    };
  }, [tables, queryKey, queryClient, subscriptionManager]);
  
  return {
    refreshData: () => queryClient.invalidateQueries({ queryKey: Array.isArray(queryKey) ? queryKey : [queryKey] }),
  };
};

/**
 * Specialized hook for dashboard subscriptions
 */
export const useDashboardSubscriptions = () => {
  return useUnifiedSubscriptions(
    [
      'jobs',
      'job_assignments',
      'job_departments',
      'job_date_types',
      'job_documents',
      'sound_job_tasks',
      'lights_job_tasks',
      'video_job_tasks',
      'sound_job_personnel',
      'lights_job_personnel',
      'video_job_personnel'
    ],
    ['jobs']
  );
};

/**
 * Specialized hook for job detail subscriptions
 */
export const useJobDetailSubscriptions = (jobId: string) => {
  return useUnifiedSubscriptions(
    [
      'job_assignments',
      'job_departments',
      'job_documents',
      'sound_job_tasks',
      'lights_job_tasks',
      'video_job_tasks',
      'sound_job_personnel',
      'lights_job_personnel',
      'video_job_personnel'
    ],
    ['jobs', jobId]
  );
};
