import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fromZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

export interface PrepDay {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  parent_job_id: string;
  status: string | null;
  color: string | null;
}

export function usePrepDays(jobId: string) {
  return useQuery({
    queryKey: ['prep-days', jobId],
    queryFn: async (): Promise<PrepDay[]> => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, start_time, end_time, parent_job_id, status, color')
        .eq('parent_job_id', jobId)
        .eq('job_type', 'prep_day')
        .order('start_time', { ascending: true });

      if (error) throw error;
      return (data || []) as PrepDay[];
    },
    enabled: !!jobId,
    staleTime: 30 * 1000,
  });
}

interface CreatePrepDayPayload {
  parentJobId: string;
  parentTitle: string;
  date: string; // YYYY-MM-DD
  parentColor?: string | null;
}

export function useCreatePrepDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ parentJobId, parentTitle, date, parentColor }: CreatePrepDayPayload) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user?.id) throw new Error('Not authenticated');

      // Build timezone-aware timestamps for Europe/Madrid (handles DST)
      const startTime = fromZonedTime(`${date}T08:00:00`, 'Europe/Madrid').toISOString();
      const endTime = fromZonedTime(`${date}T20:00:00`, 'Europe/Madrid').toISOString();

      const { data: prepJob, error: jobError } = await supabase
        .from('jobs')
        .insert({
          title: `Prep - ${parentTitle}`,
          job_type: 'prep_day',
          parent_job_id: parentJobId,
          start_time: startTime,
          end_time: endTime,
          color: parentColor || '#7E69AB',
          status: 'Confirmado',
          created_by: auth.user.id,
          timezone: 'Europe/Madrid',
        })
        .select('id')
        .single();

      if (jobError) throw jobError;

      // Copy departments from parent job
      const { data: parentDepts, error: deptError } = await supabase
        .from('job_departments')
        .select('department')
        .eq('job_id', parentJobId);

      if (deptError) throw deptError;

      if (parentDepts && parentDepts.length > 0) {
        const deptInserts = parentDepts.map((d: any) => ({
          job_id: prepJob.id,
          department: d.department,
        }));

        const { error: insertDeptError } = await supabase
          .from('job_departments')
          .insert(deptInserts);

        if (insertDeptError) {
          throw new Error(`Prep day created but failed to copy departments: ${insertDeptError.message}`);
        }
      }

      return prepJob;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prep-days', variables.parentJobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout', variables.parentJobId] });
      toast.success('Día de preparación creado');
    },
    onError: (error) => {
      console.error('Error creating prep day:', error);
      toast.error('Error al crear día de preparación');
    },
  });
}

export function useDeletePrepDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ prepDayId, parentJobId }: { prepDayId: string; parentJobId: string }) => {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', prepDayId)
        .eq('job_type', 'prep_day');

      if (error) throw error;
      return { parentJobId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['prep-days', data.parentJobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout', data.parentJobId] });
      toast.success('Día de preparación eliminado');
    },
    onError: (error) => {
      console.error('Error deleting prep day:', error);
      toast.error('Error al eliminar día de preparación');
    },
  });
}
