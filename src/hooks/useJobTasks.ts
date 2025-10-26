import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Department } from '@/types/department';

const TASK_TABLE: Record<'sound'|'lights'|'video', string> = {
  sound: 'sound_job_tasks',
  lights: 'lights_job_tasks',
  video: 'video_job_tasks',
};

export function useJobTasks(jobId?: string, department?: 'sound'|'lights'|'video', tourId?: string) {
  const table = department ? TASK_TABLE[department] : TASK_TABLE.sound;
  const contextId = tourId || jobId;

  const query = useQuery({
    queryKey: ['job-tasks', jobId, tourId, department],
    enabled: !!contextId,
    queryFn: async () => {
      let queryBuilder = supabase
        .from(table)
        .select(`*, assigned_to(id, first_name, last_name), task_documents(*)`);
      
      if (tourId) {
        queryBuilder = queryBuilder.eq('tour_id', tourId);
      } else if (jobId) {
        queryBuilder = queryBuilder.eq('job_id', jobId);
      }
      
      const { data, error } = await queryBuilder.order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  useEffect(() => {
    if (!contextId) return;
    const filterField = tourId ? 'tour_id' : 'job_id';
    const channel = supabase
      .channel(`rtm-${table}-${contextId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `${filterField}=eq.${contextId}` }, () => {
        query.refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_documents' }, () => {
        query.refetch();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextId, department]);

  return {
    tasks: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

