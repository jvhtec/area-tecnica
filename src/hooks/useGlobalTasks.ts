import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

type Dept = 'sound' | 'lights' | 'video';

const TASK_TABLE: Record<Dept, string> = {
  sound: 'sound_job_tasks',
  lights: 'lights_job_tasks',
  video: 'video_job_tasks',
};

const DOC_FK: Record<Dept, string> = {
  sound: 'sound_task_id',
  lights: 'lights_task_id',
  video: 'video_task_id',
};

export interface GlobalTaskFilters {
  status?: 'not_started' | 'in_progress' | 'completed' | null;
  assignedTo?: string | null;
  jobId?: string | null;
  tourId?: string | null;
  /** Show only tasks with no job_id and no tour_id */
  unlinked?: boolean;
}

export function useGlobalTasks(department: Dept | undefined, filters?: GlobalTaskFilters) {
  const dept: Dept = department && TASK_TABLE[department] ? department : 'sound';
  const table = TASK_TABLE[dept];
  const docFk = DOC_FK[dept];

  const query = useQuery({
    queryKey: ['global-tasks', dept, filters],
    queryFn: async () => {
      let q = supabase
        .from(table)
        .select(`
          *,
          assigned_to_profile:assigned_to(id, first_name, last_name),
          created_by_profile:created_by(id, first_name, last_name),
          job:job_id(id, title),
          tour:tour_id(id, name),
          task_documents!${docFk}(*)
        `);

      if (filters?.status) {
        q = q.eq('status', filters.status);
      }
      if (filters?.assignedTo) {
        q = q.eq('assigned_to', filters.assignedTo);
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
      .channel(`rtm-global-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        query.refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_documents' }, () => {
        query.refetch();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  return {
    tasks: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
