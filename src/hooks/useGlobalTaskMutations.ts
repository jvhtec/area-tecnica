import { supabase } from '@/lib/supabase';
import { completeTask, revertTask, Department } from '@/services/taskCompletion';

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

export function useGlobalTaskMutations(department: Dept) {
  const table = TASK_TABLE[department];
  const docFk = DOC_FK[department];

  const createTask = async (params: {
    task_type: string;
    description?: string | null;
    assigned_to?: string | null;
    job_id?: string | null;
    tour_id?: string | null;
    due_at?: string | null;
    priority?: number | null;
  }) => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id ?? null;

    const payload: Record<string, any> = {
      task_type: params.task_type,
      description: params.description || null,
      assigned_to: params.assigned_to || null,
      due_at: params.due_at || null,
      priority: params.priority ?? null,
      status: 'not_started',
      progress: 0,
      created_by: userId,
    };
    // Only set job_id / tour_id if provided (global tasks leave both null)
    if (params.job_id) payload.job_id = params.job_id;
    if (params.tour_id) payload.tour_id = params.tour_id;

    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    // Notify assignee + creator
    if (payload.assigned_to && userId) {
      try {
        await supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: 'task.assigned',
            recipient_id: payload.assigned_to,
            user_ids: [userId, payload.assigned_to],
            task_id: data.id,
            task_type: params.task_type,
          },
        });
      } catch (e) {
        console.warn('[useGlobalTaskMutations] push failed', e);
      }
    }

    return data;
  };

  const updateTask = async (id: string, fields: Record<string, any>) => {
    const sanitized: Record<string, any> = { ...fields, updated_at: new Date().toISOString() };
    const { error } = await supabase.from(table).update(sanitized).eq('id', id);
    if (error) throw error;
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
  };

  const assignUser = async (id: string, userId: string | null) => {
    const { data: authData } = await supabase.auth.getUser();
    const assignerId = authData?.user?.id ?? null;

    const { data, error } = await supabase
      .from(table)
      .update({ assigned_to: userId, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, task_type, created_by')
      .maybeSingle();
    if (error) throw error;

    if (assignerId && userId) {
      const recipients = new Set<string>();
      recipients.add(assignerId);
      recipients.add(userId);
      if (data?.created_by) recipients.add(data.created_by);

      try {
        await supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: 'task.assigned',
            recipient_id: userId,
            user_ids: Array.from(recipients),
            task_id: id,
            task_type: data?.task_type,
          },
        });
      } catch (e) {
        console.warn('[useGlobalTaskMutations] push failed', e);
      }
    }
  };

  const setStatus = async (id: string, status: 'not_started' | 'in_progress' | 'completed') => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id ?? null;

    // Fetch task before updating for notification context
    const { data: task } = await supabase
      .from(table)
      .select('id, task_type, assigned_to, created_by, job_id, tour_id')
      .eq('id', id)
      .maybeSingle();

    if (status === 'completed') {
      const result = await completeTask({
        taskId: id,
        department: department as Department,
        source: 'manual',
        jobId: task?.job_id || undefined,
        tourId: task?.tour_id || undefined,
      });
      if (!result.success) throw new Error(result.error || 'Failed to complete task');
    } else {
      const result = await revertTask({
        taskId: id,
        department: department as Department,
        newStatus: status,
      });
      if (!result.success) throw new Error(result.error || 'Failed to revert task');
    }

    // Push notification to assigner (created_by) + assignee
    if (task && userId) {
      const recipients = new Set<string>();
      recipients.add(userId);
      if (task.assigned_to) recipients.add(task.assigned_to);
      if (task.created_by) recipients.add(task.created_by);

      const notificationType = status === 'completed' ? 'task.completed' : 'task.updated';
      try {
        await supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: notificationType,
            job_id: task.job_id || undefined,
            tour_id: task.tour_id || undefined,
            recipient_id: task.assigned_to || task.created_by || undefined,
            user_ids: Array.from(recipients),
            task_id: id,
            task_type: task.task_type,
          },
        });
      } catch (e) {
        console.warn('[useGlobalTaskMutations] push failed', e);
      }
    }
  };

  const setDueDate = async (id: string, due_at: string | null) => {
    const { error } = await supabase
      .from(table)
      .update({ due_at, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  };

  const linkToJob = async (id: string, jobId: string | null) => {
    const { error } = await supabase
      .from(table)
      .update({ job_id: jobId, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  };

  const linkToTour = async (id: string, tourId: string | null) => {
    const { error } = await supabase
      .from(table)
      .update({ tour_id: tourId, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  };

  const uploadAttachment = async (taskId: string, file: File) => {
    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${taskId}/${Date.now()}_${sanitized}`;
    const { error: upErr } = await supabase.storage.from('task_documents').upload(key, file, { upsert: false });
    if (upErr) throw upErr;
    const { error: insErr } = await supabase.from('task_documents').insert({
      [docFk]: taskId,
      file_name: file.name,
      file_path: key,
    });
    if (insErr) throw insErr;
  };

  const deleteAttachment = async (docId: string, filePath: string) => {
    const { error: sErr } = await supabase.storage.from('task_documents').remove([filePath]);
    if (sErr) throw sErr;
    const { error: dErr } = await supabase.from('task_documents').delete().eq('id', docId);
    if (dErr) throw dErr;
  };

  return {
    createTask,
    updateTask,
    deleteTask,
    assignUser,
    setStatus,
    setDueDate,
    linkToJob,
    linkToTour,
    uploadAttachment,
    deleteAttachment,
  };
}
