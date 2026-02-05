import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface GlobalTaskFilters {
  status?: 'not_started' | 'in_progress' | 'completed' | null;
  assignedTo?: string | null;
  department?: string | null;
  jobId?: string | null;
  tourId?: string | null;
  unlinked?: boolean;
}

export function useGlobalTasks(filters?: GlobalTaskFilters) {
  const query = useQuery({
    queryKey: ['global-tasks', filters],
    queryFn: async () => {
      let q = supabase
        .from('global_tasks')
        .select(`
          *,
          assigned_to_profile:assigned_to(id, first_name, last_name),
          created_by_profile:created_by(id, first_name, last_name),
          job:job_id(id, title),
          tour:tour_id(id, name),
          task_documents!global_task_id(*)
        `);

      if (filters?.status) {
        q = q.eq('status', filters.status);
      }
      if (filters?.assignedTo) {
        q = q.eq('assigned_to', filters.assignedTo);
      }
      if (filters?.department) {
        q = q.eq('department', filters.department);
      }
      if (filters?.jobId) {
        q = q.eq('job_id', filters.jobId);
      }
      if (filters?.tourId) {
        q = q.eq('tour_id', filters.tourId);
      }
      if (filters?.unlinked) {
        q = q.is('job_id', null).is('tour_id', null);
      }

      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('rtm-global-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_tasks' }, () => {
        query.refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_documents' }, () => {
        query.refetch();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    tasks: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
