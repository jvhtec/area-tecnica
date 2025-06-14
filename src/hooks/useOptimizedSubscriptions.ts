import { useEffect, useCallback } from 'react';
import { useOptimizedSubscription } from '@/providers/OptimizedSubscriptionProvider';
import { createQueryKey } from '@/lib/optimized-react-query';

/**
 * Optimized hook for managing table subscriptions with batching
 */
export const useOptimizedTableSubscriptions = (
  tables: Array<{
    table: string;
    queryKey?: string | string[];
    filter?: any;
    priority?: 'high' | 'medium' | 'low';
  }>
) => {
  const { batchSubscribe, connectionStatus } = useOptimizedSubscription();

  useEffect(() => {
    if (tables.length === 0) return;

    // Prepare subscriptions with optimized query keys
    const subscriptions = tables.map(({ table, queryKey, filter, priority }) => ({
      table,
      queryKey: queryKey || [table],
      filter,
      priority: priority || 'medium' as const
    }));

    // Batch subscribe to all tables at once
    batchSubscribe(subscriptions);
  }, [tables, batchSubscribe]);

  return {
    isConnected: connectionStatus === 'connected',
    connectionStatus
  };
};

/**
 * Optimized hook for dashboard subscriptions
 */
export const useOptimizedDashboardSubscriptions = () => {
  const subscriptions = [
    { table: 'jobs', queryKey: [...createQueryKey.jobs.all], priority: 'high' as const },
    { table: 'job_assignments', queryKey: [...createQueryKey.assignments.all], priority: 'medium' as const },
    { table: 'job_documents', queryKey: [...createQueryKey.jobs.all], priority: 'medium' as const },
    { table: 'sound_job_tasks', queryKey: [...createQueryKey.tasks.all], priority: 'medium' as const },
    { table: 'lights_job_tasks', queryKey: [...createQueryKey.tasks.all], priority: 'low' as const },
    { table: 'video_job_tasks', queryKey: [...createQueryKey.tasks.all], priority: 'low' as const },
  ];

  return useOptimizedTableSubscriptions(subscriptions);
};

/**
 * Optimized hook for job detail subscriptions
 */
export const useOptimizedJobSubscriptions = (jobId: string) => {
  const subscriptions = [
    { table: 'job_assignments', queryKey: [...createQueryKey.assignments.byJob(jobId)], priority: 'high' as const },
    { table: 'job_documents', queryKey: [...createQueryKey.jobs.detail(jobId)], priority: 'medium' as const },
    { table: 'sound_job_tasks', queryKey: [...createQueryKey.tasks.byJob(jobId)], priority: 'medium' as const },
    { table: 'sound_job_personnel', queryKey: [...createQueryKey.tasks.byDepartment('sound', jobId)], priority: 'low' as const },
  ];

  return useOptimizedTableSubscriptions(subscriptions);
};

/**
 * Optimized hook for messages subscriptions (reduces notification check frequency)
 */
export const useOptimizedMessagesSubscriptions = (userId: string) => {
  const { batchSubscribe } = useOptimizedSubscription();

  const subscribeToMessages = useCallback(() => {
    const subscriptions = [
      { table: 'messages', queryKey: ['messages', userId], priority: 'low' as const },
      { table: 'direct_messages', queryKey: ['direct_messages', userId], priority: 'medium' as const },
    ];

    batchSubscribe(subscriptions);
  }, [userId, batchSubscribe]);

  useEffect(() => {
    subscribeToMessages();
  }, [subscribeToMessages]);

  return { subscribeToMessages };
};
