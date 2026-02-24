import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createQueryKey } from '@/lib/optimized-react-query';
import { normalizeDept } from '@/utils/tasks';

export interface PendingTask {
  id: string;
  job_id: string | null;
  tour_id: string | null;
  department: 'sound' | 'lights' | 'video' | 'production' | 'administrative';
  task_type: string;
  description: string | null;
  assigned_to: string | null;
  assigned_department: string | null;
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
  type: 'job' | 'tour' | 'global';
  name: string;
  client?: string;
  tasks: Array<{
    id: string;
    department: 'sound' | 'lights' | 'video' | 'production' | 'administrative';
    taskType: string;
    description: string | null;
    status: 'not_started' | 'in_progress';
    progress: number;
    dueDate: string | null;
    priority: number | null;
    createdAt: string;
    updatedAt: string;
    detailLink: string;
    jobId: string | null;
    tourId: string | null;
    assignedTo: string | null;
    assignedDepartment: string | null;
    assigneeRole: string | null;
  }>;
}

/**
 * Hook to fetch pending tasks for the current user.
 * Includes both individually-assigned tasks and department-shared tasks.
 * Only runs when a logged-in task-coordinator role is detected.
 *
 * Note: Realtime listeners were intentionally removed because multiple UI
 * consumers of this hook were creating duplicate subscriptions and causing
 * significant database load. We refresh on a short interval instead.
 */
export function usePendingTasks(userId: string | null, userRole: string | null, userDepartment?: string | null) {
  const isEligibleRole = !!userRole && ['management', 'admin', 'logistics', 'oscar'].includes(userRole);
  const normalizedDepartment = useMemo(() => normalizeDept(userDepartment) ?? null, [userDepartment]);

  return useQuery({
    queryKey: createQueryKey.pendingTasks.byUser(userId, normalizedDepartment),
    enabled: !!userId && isEligibleRole,
    queryFn: async (): Promise<GroupedPendingTask[]> => {
      // Fetch both individually-assigned tasks and department-shared tasks
      const orFilters = [`assigned_to.eq.${userId}`];
      if (normalizedDepartment) {
        orFilters.push(`assigned_department.eq.${normalizedDepartment}`);
        orFilters.push(`assigned_department.eq.${normalizedDepartment}_warehouse`);
      }

      const { data, error } = await supabase
        .from('pending_tasks_view')
        .select('*')
        .or(orFilters.join(','))
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
        const isTour = !!task.tour_id;
        const isGlobal = !isJob && !isTour;

        let groupId: string;
        let name: string;
        let type: 'job' | 'tour' | 'global';
        let detailLink: string;

        if (isJob) {
          groupId = `job-${task.job_id}`;
          name = task.job_name || 'Trabajo desconocido';
          type = 'job';
          detailLink = `/festival-management/${task.job_id}`;
        } else if (isTour) {
          groupId = `tour-${task.tour_id}`;
          name = task.tour_name || 'Gira desconocida';
          type = 'tour';
          detailLink = `/tour-management/${task.tour_id}`;
        } else {
          groupId = 'global';
          name = 'Tareas Globales';
          type = 'global';
          detailLink = '';
        }

        if (!grouped.has(groupId)) {
          grouped.set(groupId, {
            id: groupId,
            type,
            name,
            client: isGlobal ? undefined : (task.client || undefined),
            tasks: [],
          });
        }

        const group = grouped.get(groupId)!;
        group.tasks.push({
          id: task.id,
          department: task.department,
          taskType: task.task_type || 'Task',
          description: task.description || null,
          status: task.status,
          progress: task.progress || 0,
          dueDate: task.due_at,
          priority: task.priority,
          createdAt: task.created_at,
          updatedAt: task.updated_at,
          detailLink,
          jobId: task.job_id,
          tourId: task.tour_id,
          assignedTo: task.assigned_to,
          assignedDepartment: task.assigned_department,
          assigneeRole: task.assignee_role,
        });
      });

      return Array.from(grouped.values());
    },
    // Keep task badges and task modal reasonably fresh without realtime fanout.
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    staleTime: 15000,
  });
}
