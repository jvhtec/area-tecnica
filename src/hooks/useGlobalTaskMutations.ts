import { supabase } from '@/integrations/supabase/client';
import { completeTask, revertTask, Department } from '@/services/taskCompletion';
import type { Database } from '@/integrations/supabase/types';

type Dept = 'sound' | 'lights' | 'video';

type SoundTaskUpdate = Database['public']['Tables']['sound_job_tasks']['Update'];
type LightsTaskUpdate = Database['public']['Tables']['lights_job_tasks']['Update'];
type VideoTaskUpdate = Database['public']['Tables']['video_job_tasks']['Update'];
type TaskUpdate = SoundTaskUpdate | LightsTaskUpdate | VideoTaskUpdate;

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

/**
 * Returns the current UTC instant as an ISO string for timestamptz columns.
 */
function nowUTC(): string {
  return new Date().toISOString();
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_');
}

/**
 * Determine which storage bucket a task document lives in based on its file_path.
 * Paths starting with a department prefix (sound/, lights/, video/) live in
 * the `job_documents` bucket.  Paths starting with `schedules/` live in
 * `tour-documents`.  Everything else is in `task_documents`.
 */
function resolveTaskDocBucket(filePath: string): string {
  const normalized = (filePath || '').replace(/^\/+/, '');
  const first = normalized.split('/')[0] ?? '';
  if (['sound', 'lights', 'video', 'production', 'logistics', 'administrative'].includes(first)) {
    return 'job_documents';
  }
  if (first === 'schedules') {
    return 'tour-documents';
  }
  return 'task_documents';
}

export { resolveTaskDocBucket };

/**
 * Provides mutation functions for managing global tasks in a specific department.
 * Handles task CRUD operations, assignments, status changes, linking to jobs/tours,
 * and document attachments with mirroring to linked entities.
 *
 * @param department - The department ('sound', 'lights', or 'video') to operate on
 * @returns Object containing mutation functions: createTask, updateTask, deleteTask,
 *          assignUser, setStatus, setDueDate, linkTask, uploadAttachment, deleteAttachment
 */
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

    const payload: TaskUpdate & { task_type: string; status: string; progress: number } = {
      task_type: params.task_type,
      description: params.description || null,
      assigned_to: params.assigned_to || null,
      due_at: params.due_at || null,
      priority: params.priority ?? null,
      status: 'not_started',
      progress: 0,
      created_by: userId,
    };
    if (params.job_id) payload.job_id = params.job_id;
    if (params.tour_id) payload.tour_id = params.tour_id;

    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

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

  const updateTask = async (id: string, fields: TaskUpdate) => {
    const sanitized: TaskUpdate = { ...fields, updated_at: nowUTC() };
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
      .update({ assigned_to: userId, updated_at: nowUTC() })
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

    // Only send push notification for non-completed status changes.
    // completeTask() already emits a completion push, so skip here to avoid duplicates.
    if (task && userId && status !== 'completed') {
      const recipients = new Set<string>();
      recipients.add(userId);
      if (task.assigned_to) recipients.add(task.assigned_to);
      if (task.created_by) recipients.add(task.created_by);

      try {
        await supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: 'task.updated',
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
      .update({ due_at, updated_at: nowUTC() })
      .eq('id', id);
    if (error) throw error;
  };

  /**
   * Atomically set both job_id and tour_id in a single update.
   * After updating the link, mirrors any existing task documents to the
   * job/tour documents table so they're visible from the job card.
   */
  const linkTask = async (id: string, jobId: string | null, tourId: string | null) => {
    // Get the previous link state so we can clean up old mirrors
    const { data: prevTask } = await supabase
      .from(table)
      .select('job_id, tour_id')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase
      .from(table)
      .update({ job_id: jobId, tour_id: tourId, updated_at: nowUTC() })
      .eq('id', id);
    if (error) throw error;

    // Fetch existing task documents
    const { data: taskDocs } = await supabase
      .from('task_documents')
      .select('id, file_name, file_path')
      .eq(docFk, id);

    const docs = taskDocs || [];

    // Clean up old mirrors from previous link
    if (prevTask?.job_id && prevTask.job_id !== jobId) {
      for (const doc of docs) {
        const mirrorPath = `${department}/${prevTask.job_id}/task-${id}/${sanitizeFileName(doc.file_name)}`;
        await supabase.from('job_documents').delete().eq('file_path', mirrorPath);
        await supabase.storage.from('job_documents').remove([mirrorPath]).catch(() => {});
      }
    }
    if (prevTask?.tour_id && prevTask.tour_id !== tourId) {
      for (const doc of docs) {
        const mirrorPath = `schedules/${prevTask.tour_id}/task-${id}/${sanitizeFileName(doc.file_name)}`;
        await supabase.from('tour_documents').delete().eq('file_path', mirrorPath);
        await supabase.storage.from('tour-documents').remove([mirrorPath]).catch(() => {});
      }
    }

    // Create new mirrors for the new link
    if (docs.length > 0 && (jobId || tourId)) {
      for (const doc of docs) {
        try {
          await mirrorDocToLinkedEntity(id, doc, jobId, tourId);
        } catch (e) {
          console.warn('[useGlobalTaskMutations] mirror doc failed', e);
        }
      }
    }
  };

  /**
   * Copy a task document file into the linked job/tour bucket and create
   * a corresponding record so it appears on the job card / tour view.
   */
  const mirrorDocToLinkedEntity = async (
    taskId: string,
    doc: { file_name: string; file_path: string },
    jobId: string | null,
    tourId: string | null,
  ) => {
    // Download from whichever bucket the file currently lives in
    const srcBucket = resolveTaskDocBucket(doc.file_path);
    const { data: blob } = await supabase.storage.from(srcBucket).download(doc.file_path);
    if (!blob) return;

    const safeName = sanitizeFileName(doc.file_name);

    if (jobId) {
      const destPath = `${department}/${jobId}/task-${taskId}/${safeName}`;
      await supabase.storage.from('job_documents').upload(destPath, blob, { upsert: true });
      // Idempotent: delete any existing row first, then insert
      await supabase.from('job_documents').delete().eq('file_path', destPath);
      await supabase.from('job_documents').insert({
        job_id: jobId,
        file_name: doc.file_name,
        file_path: destPath,
        visible_to_tech: false,
      });
    }

    if (tourId) {
      const destPath = `schedules/${tourId}/task-${taskId}/${safeName}`;
      await supabase.storage.from('tour-documents').upload(destPath, blob, { upsert: true });
      await supabase.from('tour_documents').delete().eq('file_path', destPath);
      await supabase.from('tour_documents').insert({
        tour_id: tourId,
        file_name: doc.file_name,
        file_path: destPath,
      });
    }
  };

  /**
   * Upload a document attached to a task.
   * When the task is linked to a job or tour the file is ALSO stored in the
   * corresponding job/tour document bucket and table so it's visible from
   * the job card.
   */
  const uploadAttachment = async (
    taskId: string,
    file: File,
    context?: { jobId?: string | null; tourId?: string | null },
  ) => {
    const safeName = sanitizeFileName(file.name);
    const jobId = context?.jobId ?? null;
    const tourId = context?.tourId ?? null;

    // 1. Always store in task_documents bucket + table
    const taskKey = `${taskId}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage
      .from('task_documents')
      .upload(taskKey, file, { upsert: false });
    if (upErr) throw upErr;

    const { error: insErr } = await supabase.from('task_documents').insert({
      [docFk]: taskId,
      file_name: file.name,
      file_path: taskKey,
    });
    if (insErr) throw insErr;

    // 2. Mirror to job bucket if linked (idempotent: delete-before-insert)
    if (jobId) {
      const jobPath = `${department}/${jobId}/task-${taskId}/${safeName}`;
      await supabase.storage.from('job_documents').upload(jobPath, file, { upsert: true });
      // Remove any existing row to avoid duplicates
      await supabase.from('job_documents').delete().eq('file_path', jobPath);
      await supabase.from('job_documents').insert({
        job_id: jobId,
        file_name: file.name,
        file_path: jobPath,
        visible_to_tech: false,
      });
    }

    // 3. Mirror to tour bucket if linked (idempotent: delete-before-insert)
    if (tourId) {
      const tourPath = `schedules/${tourId}/task-${taskId}/${safeName}`;
      await supabase.storage.from('tour-documents').upload(tourPath, file, { upsert: true });
      // Remove any existing row to avoid duplicates
      await supabase.from('tour_documents').delete().eq('file_path', tourPath);
      await supabase.from('tour_documents').insert({
        tour_id: tourId,
        file_name: file.name,
        file_path: tourPath,
      });
    }
  };

  /**
   * Delete attachment: DB row first, then storage file.
   * Also cleans up any mirrored copies in job/tour document buckets.
   */
  const deleteAttachment = async (
    docId: string,
    filePath: string,
    context?: { taskId?: string; jobId?: string | null; tourId?: string | null },
  ) => {
    // Delete from task_documents table
    const { error: dErr } = await supabase.from('task_documents').delete().eq('id', docId);
    if (dErr) throw dErr;

    // Delete from task_documents storage
    await supabase.storage.from('task_documents').remove([filePath]).catch(() => {});

    // Extract the original filename from the stored path.
    // uploadAttachment stores as `${taskId}/${timestamp}_${safeName}`, so
    // basename is `timestamp_safeName`. Strip the timestamp prefix (everything
    // up to and including the first underscore) to get the original safeName.
    const basename = filePath.split('/').pop() || '';
    const underscoreIdx = basename.indexOf('_');
    const originalSafeName = underscoreIdx >= 0 ? basename.slice(underscoreIdx + 1) : basename;
    const safeName = sanitizeFileName(originalSafeName);

    // Clean up mirrored copy in job_documents if linked
    if (context?.jobId && context?.taskId) {
      const jobPath = `${department}/${context.jobId}/task-${context.taskId}/${safeName}`;
      await supabase.from('job_documents').delete().eq('file_path', jobPath);
      await supabase.storage.from('job_documents').remove([jobPath]).catch(() => {});
    }

    // Clean up mirrored copy in tour_documents if linked
    if (context?.tourId && context?.taskId) {
      const tourPath = `schedules/${context.tourId}/task-${context.taskId}/${safeName}`;
      await supabase.from('tour_documents').delete().eq('file_path', tourPath);
      await supabase.storage.from('tour-documents').remove([tourPath]).catch(() => {});
    }
  };

  return {
    createTask,
    updateTask,
    deleteTask,
    assignUser,
    setStatus,
    setDueDate,
    linkTask,
    uploadAttachment,
    deleteAttachment,
  };
}
