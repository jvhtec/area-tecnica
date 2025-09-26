import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Department } from '@/types/department';

const TASK_TABLE: Record<'sound'|'lights'|'video', string> = {
  sound: 'sound_job_tasks',
  lights: 'lights_job_tasks',
  video: 'video_job_tasks',
};

export function useJobTasks(jobId: string, department: 'sound'|'lights'|'video') {
  const table = TASK_TABLE[department];

  const query = useQuery({
    queryKey: ['job-tasks', jobId, department],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select(`*, assigned_to(id, first_name, last_name), task_documents(*)`)
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  useEffect(() => {
    if (!jobId) return;
    const channel = supabase
      .channel(`rtm-${table}-${jobId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `job_id=eq.${jobId}` }, () => {
        query.refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_documents' }, () => {
        query.refetch();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, department]);

  return {
    tasks: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

