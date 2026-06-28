import { useQuery } from '@tanstack/react-query';
import { dataLayerClient } from '@/services/dataLayerClient';
import { queryKeys } from '@/lib/react-query';

export type DirectJobAssignment = {
  technician_id: string;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  single_day: boolean | null;
  assignment_date: string | null;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    department: string | null;
  } | null;
};

export function useDirectJobAssignments(jobId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.scope('job-assignments-direct', jobId),
    enabled: enabled && !!jobId,
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('job_assignments')
        .select(`
          technician_id,
          sound_role,
          lights_role,
          video_role,
          single_day,
          assignment_date,
          profiles (
            first_name,
            last_name,
            email,
            department
          )
        `)
        .eq('job_id', jobId);

      if (error) throw error;
      return (data || []) as unknown as DirectJobAssignment[];
    },
    staleTime: 30_000,
  });
}
