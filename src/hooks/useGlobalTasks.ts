import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

interface ProfileRef {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface TaskDocument {
  id: string;
  file_name: string;
  file_path: string;
}

export interface GlobalTask {
  id: string;
  task_type: string;
  description: string | null;
  status: string | null;
  progress: number | null;
  priority: number | null;
  due_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  job_id: string | null;
  tour_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  completion_source: string | null;
  assigned_to_profile: ProfileRef | null;
  created_by_profile: ProfileRef | null;
  job: { id: string; title: string } | null;
  tour: { id: string; name: string } | null;
  task_documents: TaskDocument[];
}

export function useGlobalTasks(department: Dept | undefined, filters?: GlobalTaskFilters): {
  tasks: GlobalTask[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const dept: Dept = department && TASK_TABLE[department] ? department : 'sound';
  const table = TASK_TABLE[dept];
  const docFk = DOC_FK[dept];
  const queryClient = useQueryClient();

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
      return (data || []) as GlobalTask[];
    },
  });

  // Invalidate by query-key prefix so the *current* filter combination is
  // always refreshed, regardless of which filters were active when the
  // subscription was created.
  useEffect(() => {
    const channel = supabase
      .channel(`rtm-global-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        queryClient.invalidateQueries({ queryKey: ['global-tasks', dept] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_documents' }, () => {
        queryClient.invalidateQueries({ queryKey: ['global-tasks', dept] });
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [table, dept, queryClient]);

  return {
    tasks: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
