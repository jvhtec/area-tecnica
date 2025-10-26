import { supabase } from '@/lib/supabase';
import { completeTask, revertTask, Department } from '@/services/taskCompletion';

type Dept = 'sound'|'lights'|'video';

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

export function useTaskMutations(jobId?: string, department?: Dept, tourId?: string) {
  const table = department ? TASK_TABLE[department] : TASK_TABLE.sound;
  const docFk = department ? DOC_FK[department] : DOC_FK.sound;
  const contextId = tourId || jobId;

  const createTask = async (task_type: string, assigned_to?: string | null, due_at?: string | null) => {
    const payload: any = { task_type, status: 'not_started', progress: 0 };
    if (tourId) {
      payload.tour_id = tourId;
    } else if (jobId) {
      payload.job_id = jobId;
    }
    if (assigned_to) payload.assigned_to = assigned_to;
    if (due_at) payload.due_at = due_at;
    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) throw error;
    return data;
  };

  const updateTask = async (id: string, fields: Record<string, any>) => {
    const { error } = await supabase.from(table).update(fields).eq('id', id);
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
      .update({ assigned_to: userId })
      .eq('id', id)
      .select('id, task_type')
      .maybeSingle();
    if (error) throw error;

    if (assignerId && userId) {
      try {
        await supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: 'task.assigned',
            job_id: jobId || undefined,
            tour_id: tourId || undefined,
            recipient_id: userId,
            user_ids: [assignerId, userId],
            task_id: id,
            task_type: data?.task_type,
          },
        });
      } catch (pushError) {
        console.warn('useTaskMutations.assignUser push failed', pushError);
      }
    }
  };

  const setStatus = async (id: string, status: 'not_started'|'in_progress'|'completed') => {
    if (!department) {
      throw new Error('Department is required for setStatus');
    }

    // Use the centralized task completion service
    if (status === 'completed') {
      const result = await completeTask({
        taskId: id,
        department: department as Department,
        source: 'manual',
        jobId,
        tourId,
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to complete task');
      }
    } else {
      // Revert to active state (clear completion metadata)
      const result = await revertTask({
        taskId: id,
        department: department as Department,
        newStatus: status,
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to revert task');
      }
    }
  };

  const setDueDate = async (id: string, due_at: string | null) => {
    const { error } = await supabase.from(table).update({ due_at }).eq('id', id);
    if (error) throw error;
  };

  const uploadAttachment = async (taskId: string, file: File) => {
    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${taskId}/${Date.now()}_${sanitized}`;
    const { error: upErr } = await supabase.storage.from('task_documents').upload(key, file, { upsert: false });
    if (upErr) throw upErr;
    const { error: insErr } = await supabase.from('task_documents').insert({ [docFk]: taskId, file_name: file.name, file_path: key });
    if (insErr) throw insErr;
    // Do not auto-complete; leave explicit status control in UI
  };

  const deleteAttachment = async (docId: string, filePath: string) => {
    const { error: sErr } = await supabase.storage.from('task_documents').remove([filePath]);
    if (sErr) throw sErr;
    const { error: dErr } = await supabase.from('task_documents').delete().eq('id', docId);
    if (dErr) throw dErr;
  };

  return { createTask, updateTask, deleteTask, assignUser, setStatus, setDueDate, uploadAttachment, deleteAttachment };
}

