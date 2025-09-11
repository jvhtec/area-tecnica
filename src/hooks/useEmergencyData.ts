import { useQuery } from '@tanstack/react-query';
import { emergencyQueries } from '@/lib/emergency-database-client';
import { toast } from 'sonner';

/**
 * Emergency data hooks with graceful degradation and manual refresh
 */

export function useEmergencyJobs() {
  return useQuery({
    queryKey: ['emergency-jobs'],
    queryFn: emergencyQueries.getJobs,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (renamed from cacheTime)
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
    refetchOnWindowFocus: false,
    retry: 1
  });
}

export function useEmergencyProfiles() {
  return useQuery({
    queryKey: ['emergency-profiles'],
    queryFn: emergencyQueries.getProfiles,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour (renamed from cacheTime)
    refetchInterval: 15 * 60 * 1000, // Refresh every 15 minutes
    refetchOnWindowFocus: false,
    retry: 1
  });
}

export function useEmergencyJobAssignments(jobId?: string) {
  return useQuery({
    queryKey: ['emergency-job-assignments', jobId],
    queryFn: () => emergencyQueries.getJobAssignments(jobId),
    enabled: !!jobId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (renamed from cacheTime)
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
    refetchOnWindowFocus: false,
    retry: 1
  });
}

export function useEmergencyUserPreferences(userId: string) {
  return useQuery({
    queryKey: ['emergency-user-preferences', userId],
    queryFn: () => emergencyQueries.getUserPreferences(userId),
    enabled: !!userId,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour (renamed from cacheTime)
    refetchInterval: false, // Don't auto-refresh preferences
    refetchOnWindowFocus: false,
    retry: 1
  });
}

/**
 * Manual refresh helper for emergency mode
 */
export function useEmergencyRefresh() {
  const refreshJobs = () => {
    return emergencyQueries.getJobs();
  };

  const refreshProfiles = () => {
    return emergencyQueries.getProfiles();
  };

  const refreshAssignments = (jobId?: string) => {
    return emergencyQueries.getJobAssignments(jobId);
  };

  return {
    refreshJobs,
    refreshProfiles,
    refreshAssignments
  };
}