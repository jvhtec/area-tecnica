import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface PendingTask {
  id: string;
  job_id: string | null;
  tour_id: string | null;
  department: 'sound' | 'lights' | 'video';
  task_type: string;
  assigned_to: string;
  status: 'not_started' | 'in_progress';
  progress: number;
  due_at: string | null;
  priority: number | null;
  created_at: string;
  updated_at: string;
  job_name: string | null;
  client: string | null;
  tour_name: string | null;
  assignee_first_name: string | null;
  assignee_last_name: string | null;
  assignee_role: string | null;
}

export interface GroupedPendingTask {
  id: string;
  type: 'job' | 'tour';
  name: string;
  client?: string;
  tasks: Array<{
    id: string;
    department: 'sound' | 'lights' | 'video';
    taskType: string;
    status: 'not_started' | 'in_progress';
    progress: number;
    dueDate: string | null;
    priority: number | null;
    detailLink: string;
    jobId: string | null;
    tourId: string | null;
    assignedTo: string;
    assigneeRole: string | null;
  }>;
}

const TASK_TABLES = ['sound_job_tasks', 'lights_job_tasks', 'video_job_tasks'] as const;

type TaskRow = Record<string, unknown> & { assigned_to?: string | null };

/**
 * Hook to fetch pending tasks for the current user
 * Only runs when a logged-in management/admin/logistics user is detected
 */
export function usePendingTasks(userId: string | null, userRole: string | null) {
  const isEligibleRole = !!userRole && ['management', 'admin', 'logistics'].includes(userRole);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !isEligibleRole) {
      return;
    }

    const channel = supabase.channel(
      `pending-tasks-${userId}-${Math.random().toString(36).slice(2, 10)}`
    );

    const invalidatePendingTasks = () => {
      queryClient.invalidateQueries({ queryKey: ['pending-tasks', userId] });
    };

    TASK_TABLES.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `assigned_to=eq.${userId}` },
        invalidatePendingTasks
      );

      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table },
        (payload: RealtimePostgresChangesPayload<TaskRow>) => {
          const previousAssignee = payload.old?.assigned_to ?? null;
          const nextAssignee = payload.new?.assigned_to ?? null;

          if (previousAssignee === userId && nextAssignee !== userId) {
            invalidatePendingTasks();
          }
        }
      );
    });

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, isEligibleRole, queryClient]);

  return useQuery({
    queryKey: ['pending-tasks', userId],
    enabled: !!userId && isEligibleRole,
    queryFn: async (): Promise<GroupedPendingTask[]> => {
      const { data, error } = await supabase
        .from('pending_tasks_view')
        .select('*')
        .eq('assigned_to', userId)
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching pending tasks:', error);
        throw error;
      }

      // Group tasks by job/tour
      const grouped = new Map<string, GroupedPendingTask>();

      (data || []).forEach((task: PendingTask) => {
        const isJob = !!task.job_id;
        const groupId = isJob ? `job-${task.job_id}` : `tour-${task.tour_id}`;
        const name = isJob ? task.job_name || 'Unknown Job' : task.tour_name || 'Unknown Tour';
        const detailLink = isJob
          ? `/job-management/${task.job_id}`
          : `/tour-management/${task.tour_id}`;

        if (!grouped.has(groupId)) {
          grouped.set(groupId, {
            id: groupId,
            type: isJob ? 'job' : 'tour',
            name,
            client: task.client || undefined,
            tasks: [],
          });
        }

        const group = grouped.get(groupId)!;
        group.tasks.push({
          id: task.id,
          department: task.department,
          taskType: task.task_type || 'Task',
          status: task.status,
          progress: task.progress || 0,
          dueDate: task.due_at,
          priority: task.priority,
          detailLink,
          jobId: task.job_id,
          tourId: task.tour_id,
          assignedTo: task.assigned_to,
          assigneeRole: task.assignee_role,
        });
      });

      return Array.from(grouped.values());
    },
    // Refetch on window focus to catch new assignments
    refetchOnWindowFocus: true,
    // Keep data fresh
    staleTime: 30000, // 30 seconds
  });
}
