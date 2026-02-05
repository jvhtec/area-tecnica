import { supabase } from '@/lib/supabase';

export function useGlobalTaskMutations() {
  const createTask = async (params: {
    title: string;
    description?: string | null;
    assigned_to?: string | null;
    department?: string | null;
    job_id?: string | null;
    tour_id?: string | null;
    due_at?: string | null;
    priority?: number | null;
  }) => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id ?? null;

    const payload = {
      title: params.title,
      description: params.description || null,
      assigned_to: params.assigned_to || null,
      department: params.department || null,
      job_id: params.job_id || null,
      tour_id: params.tour_id || null,
      due_at: params.due_at || null,
      priority: params.priority ?? null,
      status: 'not_started' as const,
      progress: 0,
      created_by: userId,
    };

    const { data, error } = await supabase
      .from('global_tasks')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    // Notify assignee
    if (payload.assigned_to && userId) {
      try {
        await supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: 'task.assigned',
            recipient_id: payload.assigned_to,
            user_ids: [userId, payload.assigned_to],
            task_id: data.id,
            task_type: payload.title,
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
    const { error } = await supabase.from('global_tasks').update(sanitized).eq('id', id);
    if (error) throw error;
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('global_tasks').delete().eq('id', id);
    if (error) throw error;
  };

  const assignUser = async (id: string, userId: string | null) => {
    const { data: authData } = await supabase.auth.getUser();
    const assignerId = authData?.user?.id ?? null;

    const { data, error } = await supabase
      .from('global_tasks')
      .update({ assigned_to: userId, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, title')
      .maybeSingle();
    if (error) throw error;

    if (assignerId && userId) {
      try {
        await supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: 'task.assigned',
            recipient_id: userId,
            user_ids: [assignerId, userId],
            task_id: id,
            task_type: data?.title,
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

    const updates: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed') {
      updates.progress = 100;
      updates.completed_at = new Date().toISOString();
      updates.completed_by = userId;
      updates.completion_source = 'manual';
    } else {
      updates.progress = status === 'in_progress' ? 50 : 0;
      updates.completed_at = null;
      updates.completed_by = null;
      updates.completion_source = null;
    }

    const { error } = await supabase.from('global_tasks').update(updates).eq('id', id);
    if (error) throw error;
  };

  const setDueDate = async (id: string, due_at: string | null) => {
    const { error } = await supabase
      .from('global_tasks')
      .update({ due_at, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  };

  const linkToJob = async (id: string, jobId: string | null) => {
    const { error } = await supabase
      .from('global_tasks')
      .update({ job_id: jobId, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  };

  const linkToTour = async (id: string, tourId: string | null) => {
    const { error } = await supabase
      .from('global_tasks')
      .update({ tour_id: tourId, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  };

  const uploadAttachment = async (taskId: string, file: File) => {
    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `global/${taskId}/${Date.now()}_${sanitized}`;
    const { error: upErr } = await supabase.storage.from('task_documents').upload(key, file, { upsert: false });
    if (upErr) throw upErr;
    const { error: insErr } = await supabase.from('task_documents').insert({
      global_task_id: taskId,
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
