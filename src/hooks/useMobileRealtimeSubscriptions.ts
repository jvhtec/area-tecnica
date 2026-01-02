import { useEffect } from 'react';
import { useMultiTableSubscription } from '@/hooks/useSubscription';

/**
 * Specialized hook for mobile components that need comprehensive realtime subscriptions
 */
export const useMobileRealtimeSubscriptions = (options: {
  /** Include job-related tables (jobs, job_documents, locations) */
  includeJobs?: boolean;
  /** Include job assignment tables */
  includeAssignments?: boolean;
  /** Include job date types table */
  includeDateTypes?: boolean;
  /** Include job departments table */
  includeDepartments?: boolean;
  /** Custom query key for invalidation */
  queryKey?: string | string[];
  /** Priority level for subscriptions */
  priority?: 'high' | 'medium' | 'low';
}) => {
  const {
    includeJobs = true,
    includeAssignments = false,
    includeDateTypes = false,
    includeDepartments = false,
    queryKey = ['mobile-data'],
    priority = 'high'
  } = options;

  const tables = [];

  if (includeJobs) {
    tables.push(
      { table: 'jobs', queryKey, priority },
      { table: 'job_documents', queryKey, priority },
      { table: 'locations', queryKey, priority }
    );
  }

  if (includeAssignments) {
    tables.push(
      { table: 'job_assignments', queryKey, priority }
    );
  }

  if (includeDateTypes) {
    tables.push(
      { table: 'job_date_types', queryKey, priority }
    );
  }

  if (includeDepartments) {
    tables.push(
      { table: 'job_departments', queryKey, priority }
    );
  }

  const subscription = useMultiTableSubscription(tables);

  return subscription;
};

/**
 * Hook for technician dashboard with all required subscriptions
 */
export const useTechnicianDashboardSubscriptions = () => {
  return useMobileRealtimeSubscriptions({
    includeJobs: true,
    includeAssignments: true,
    includeDepartments: true,
    queryKey: ['assignments'],
    priority: 'high'
  });
};

/**
 * Hook for mobile day calendar with date-specific subscriptions
 */
export const useMobileDayCalendarSubscriptions = () => {
  return useMobileRealtimeSubscriptions({
    includeJobs: true,
    includeDateTypes: true,
    includeDepartments: true,
    queryKey: ['optimized-jobs'],
    priority: 'high'
  });
};

/**
 * Hook for assignments list with document subscriptions
 */
export const useAssignmentsListSubscriptions = () => {
  return useMobileRealtimeSubscriptions({
    includeJobs: true,
    queryKey: ['assignments'],
    priority: 'medium'
  });
};
