import { useQuery } from '@tanstack/react-query';
import { createQueryKey } from '@/lib/optimized-react-query';
import { dataLayerClient } from '@/services/dataLayerClient';
import { isJobPastClosureWindow } from '@/utils/jobClosureUtils';
import { isAdminRole } from '@/utils/permissions';

type JobClosureMeta = {
  id: string;
  end_time: string | null;
  timezone: string | null;
};

export function useJobClosureLock(jobId: string, userRole: string | null | undefined) {
  const { data: jobMeta, isError: jobMetaError } = useQuery({
    queryKey: createQueryKey.jobs.meta(jobId),
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('jobs')
        .select('id, end_time, timezone')
        .eq('id', jobId)
        .maybeSingle();
      if (error) throw error;
      return data as JobClosureMeta | null;
    },
    staleTime: 60_000,
  });

  const isAdmin = isAdminRole(userRole);
  const isPastClosureWindow = (() => {
    if (jobMetaError) return true;
    if (jobMeta === undefined) return true;
    if (!jobMeta) return false;
    return isJobPastClosureWindow(jobMeta.end_time, jobMeta.timezone ?? 'Europe/Madrid');
  })();

  return {
    isClosureLocked: isPastClosureWindow && !isAdmin,
    isAdminOverridingClosure: isPastClosureWindow && isAdmin && jobMeta !== undefined && !jobMetaError,
  };
}
