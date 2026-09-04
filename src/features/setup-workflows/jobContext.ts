import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query';
import { dataLayerClient } from '@/services/dataLayerClient';
import type { Job } from '@/types/job';
import type { SetupDepartment } from './types';

export type SetupJob = Job & {
  job_departments: Array<{ department: string }>;
  location?: { id: string; name: string; formatted_address?: string | null } | null;
};

const setupDepartments = new Set<SetupDepartment>([
  'sound', 'lights', 'video', 'production', 'personnel', 'estructura',
]);

export function getSetupJobDepartments(job?: SetupJob | null): SetupDepartment[] {
  if (!job) return [];
  return [...new Set(job.job_departments
    .map(({ department }) => department)
    .filter((department): department is SetupDepartment => setupDepartments.has(department as SetupDepartment)))]
    .sort();
}

export function useSetupJob(jobId?: string) {
  return useQuery({
    queryKey: queryKeys.scope('setup-job', jobId),
    enabled: Boolean(jobId),
    queryFn: async () => {
      const { data, error } = await dataLayerClient
        .from('jobs')
        .select('*, job_departments(department), location:locations(id, name, formatted_address)')
        .eq('id', jobId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No se ha encontrado el trabajo.');
      return data as unknown as SetupJob;
    },
  });
}
