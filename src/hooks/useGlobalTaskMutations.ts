import { supabase } from '@/integrations/supabase/client';
import { completeTask, revertTask, Department } from '@/services/taskCompletion';
import type { Database } from '@/integrations/supabase/types';
import { type Dept } from '@/utils/tasks';
import { isTaskAssigneeUniqueConflict } from '@/utils/taskAssignment';

type SoundTaskUpdate = Database['public']['Tables']['sound_job_tasks']['Update'];
type LightsTaskUpdate = Database['public']['Tables']['lights_job_tasks']['Update'];
type VideoTaskUpdate = Database['public']['Tables']['video_job_tasks']['Update'];
type ProductionTaskUpdate = Database['public']['Tables']['production_job_tasks']['Update'];
type AdministrativeTaskUpdate = Database['public']['Tables']['administrative_job_tasks']['Update'];
type TaskDocumentsRow = Database['public']['Tables']['task_documents']['Row'];
type TaskUpdate =
  | SoundTaskUpdate
  | LightsTaskUpdate
  | VideoTaskUpdate
  | ProductionTaskUpdate
  | AdministrativeTaskUpdate;

type TaskTableName =
  | 'sound_job_tasks'
  | 'lights_job_tasks'
  | 'video_job_tasks'
  | 'production_job_tasks'
  | 'administrative_job_tasks';

type DynamicTableName = TaskTableName | 'task_documents';

interface SupabaseErrorLike {
  message: string;
  code?: string;
}

interface QueryResult<TData> {
  data: TData;
  error: SupabaseErrorLike | null;
}

type RowFromArray<TData> = TData extends Array<infer TRow> ? TRow : TData;

interface TaskFilterBuilder<TData> extends PromiseLike<QueryResult<TData>> {
  eq(column: string, value: unknown): this;
  neq(column: string, value: unknown): this;
  in(column: string, values: unknown[]): this;
  is(column: string, value: null): this;
  limit(count: number): this;
  select<TNext = TData>(columns?: string): TaskFilterBuilder<TNext>;
  single<TSingle = RowFromArray<TData>>(): PromiseLike<QueryResult<TSingle>>;
  maybeSingle<TSingle = RowFromArray<TData>>(): PromiseLike<QueryResult<TSingle | null>>;
}

interface TaskTableBuilder {
  select<TData = unknown[]>(columns?: string): TaskFilterBuilder<TData>;
  update<TData = unknown[]>(values: Record<string, unknown>): TaskFilterBuilder<TData>;
  insert<TData = unknown[]>(values: Record<string, unknown> | Array<Record<string, unknown>>): TaskFilterBuilder<TData>;
  delete<TData = unknown[]>(): TaskFilterBuilder<TData>;
}

interface TaskMutationRow {
  id: string;
  task_type: string | null;
  assigned_to: string | null;
  created_by: string | null;
  job_id: string | null;
  tour_id: string | null;
}

interface TaskDocumentRow {
  id: string;
  file_name: string;
  file_path: string;
  job_id?: string | null;
  tour_id?: string | null;
}

const TASK_TABLE: Record<Dept, TaskTableName> = {
  sound: 'sound_job_tasks',
  lights: 'lights_job_tasks',
  video: 'video_job_tasks',
  production: 'production_job_tasks',
  administrative: 'administrative_job_tasks',
};

const DOC_FK: Record<Dept, string> = {
  sound: 'sound_task_id',
  lights: 'lights_task_id',
  video: 'video_task_id',
  production: 'production_task_id',
  administrative: 'administrative_task_id',
};

type DynamicSupabaseClient = {
  from: (table: DynamicTableName) => TaskTableBuilder;
};

const dynamicSupabase = supabase as unknown as DynamicSupabaseClient;
const fromDynamicTable = (table: DynamicTableName) => dynamicSupabase.from(table);

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

export type AssignUserResult =
  | { status: 'updated'; taskId: string; userId: string | null }
  | { status: 'no_change'; taskId: string; userId: string | null }
  | {
      status: 'already_assigned';
      taskId: string;
      userId: string;
      conflictTaskId?: string | null;
      taskType?: string | null;
      jobId?: string | null;
      tourId?: string | null;
    };

/**
 * Provides mutation functions for managing global tasks in a specific department.
 * Handles task CRUD operations, assignments, status changes, linking to jobs/tours,
 * and document attachments with mirroring to linked entities.
 *
 * @param department - The department to operate on
 * @returns Object containing mutation functions: createTask, updateTask, deleteTask,
 *          assignUser, setStatus, setDueDate, linkTask, uploadAttachment, deleteAttachment
 */
export function useGlobalTaskMutations(department: Dept) {
  const table = TASK_TABLE[department];
  const docFk = DOC_FK[department];

  /**
   * Internal helper that inserts a task into a specific department table.
   *
   * Centralizes validation + created_by population to keep behavior consistent
   * between createTask and createTaskForDepartment.
   */
  const createTaskInTable = async (targetTable: TaskTableName, params: {
    task_type: string;
    description?: string | null;
    assigned_to?: string | null;
    assigned_department?: string | null;
    job_id?: string | null;
    tour_id?: string | null;
    due_at?: string | null;
    priority?: number | null;
  }) => {
    if (params.job_id != null && params.tour_id != null) {
      throw new Error('Validation error: job_id and tour_id are mutually exclusive');
    }

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id ?? null;

    const payload: TaskUpdate & { task_type: string; status: string; progress: number } = {
      task_type: params.task_type,
      description: params.description || null,
      assigned_to: params.assigned_to || null,
      assigned_department: params.assigned_department || null,
      due_at: params.due_at || null,
      priority: params.priority ?? null,
      status: 'not_started',
      progress: 0,
      created_by: userId,
    };
    if (params.job_id) payload.job_id = params.job_id;
    if (params.tour_id) payload.tour_id = params.tour_id;

    const { data, error } = await fromDynamicTable(targetTable)
      .insert(payload)
      .select<TaskMutationRow[]>()
      .single();
    if (error) throw error;

    return { data, payload, userId };
  };

  const createTask = async (params: {
    task_type: string;
    description?: string | null;
    assigned_to?: string | null;
    assigned_department?: string | null;
    job_id?: string | null;
    tour_id?: string | null;
    due_at?: string | null;
    priority?: number | null;
  }) => {
    const { data, payload, userId } = await createTaskInTable(table, params);

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

  /**
   * Create a task in a specific department's table. Identical to createTask but
   * allows the caller to specify a target department different from the one
   * this hook was instantiated with. Used by ASSIGN_SELECTED_DEPARTMENTS to
   * create shared tasks across multiple departments from a single call-site.
   */
  const createTaskForDepartment = async (
    targetDept: Dept,
    params: Parameters<typeof createTask>[0],
  ) => {
    const targetTable = TASK_TABLE[targetDept];
    const { data, payload, userId } = await createTaskInTable(targetTable, params);

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

  const createTasksForUsers = async (
    params: {
      task_type: string;
      description?: string | null;
      job_id?: string | null;
      tour_id?: string | null;
      due_at?: string | null;
      priority?: number | null;
    },
    assigneeIds: string[],
  ) => {
    if (params.job_id != null && params.tour_id != null) {
      throw new Error('Validation error: job_id and tour_id are mutually exclusive');
    }
    if (!assigneeIds.length) {
      return { created: [], skippedAssigneeIds: [] as string[] };
    }
    const normalizedAssigneeIds = Array.from(
      new Set(
        assigneeIds
          .map((id) => (typeof id === 'string' ? id.trim() : ''))
          .filter((id): id is string => id.length > 0)
      )
    );
    if (!normalizedAssigneeIds.length) {
      return { created: [], skippedAssigneeIds: assigneeIds };
    }

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id ?? null;

    const payloadBase: TaskUpdate & { task_type: string; status: string; progress: number } = {
      task_type: params.task_type,
      description: params.description || null,
      due_at: params.due_at || null,
      priority: params.priority ?? null,
      status: 'not_started',
      progress: 0,
      created_by: userId,
    };
    if (params.job_id) payloadBase.job_id = params.job_id;
    if (params.tour_id) payloadBase.tour_id = params.tour_id;

    let existingQuery = fromDynamicTable(table)
      .select<Array<Pick<TaskMutationRow, 'assigned_to'>>>('assigned_to')
      .eq('task_type', params.task_type)
      .in('assigned_to', normalizedAssigneeIds);

    if (params.job_id) {
      existingQuery = existingQuery.eq('job_id', params.job_id);
    } else if (params.tour_id) {
      existingQuery = existingQuery.eq('tour_id', params.tour_id);
    }

    const { data: existingTasks, error: existingError } = await existingQuery;
    if (existingError) throw existingError;

    const existingAssignees = new Set(
      (existingTasks || [])
        .map((row) => row.assigned_to)
        .filter((id: string | null) => Boolean(id))
    );

    const assigneeIdsToCreate = normalizedAssigneeIds.filter((id) => !existingAssignees.has(id));
    const skippedAssigneeIds = normalizedAssigneeIds.filter((id) => existingAssignees.has(id));

    if (!assigneeIdsToCreate.length) {
      return { created: [], skippedAssigneeIds };
    }

    const payloads = assigneeIdsToCreate.map((assigneeId) => ({
      ...payloadBase,
      assigned_to: assigneeId,
    }));

    const { data, error } = await fromDynamicTable(table).insert(payloads).select<Array<Pick<TaskMutationRow, 'id' | 'assigned_to'>>>('id, assigned_to');
    if (error) throw error;

    return { created: data || [], skippedAssigneeIds };
  };

  const updateTask = async (id: string, fields: TaskUpdate) => {
    const sanitized: TaskUpdate = { ...fields, updated_at: nowUTC() };
    const { error } = await fromDynamicTable(table).update(sanitized).eq('id', id);
    if (error) throw error;
  };

  const deleteTask = async (id: string) => {
    const failures: string[] = [];

    // First, get the task to know job_id/tour_id for mirror cleanup
    const { data: task } = await fromDynamicTable(table)
      .select<Pick<TaskMutationRow, 'job_id' | 'tour_id'>[]>('job_id, tour_id')
      .eq('id', id)
      .maybeSingle();

    // Fetch all attachments for this task
    const { data: docs } = await fromDynamicTable('task_documents')
      .select<Array<Pick<TaskDocumentRow, 'id' | 'file_path'>>>('id, file_path')
      .eq(docFk, id);

    // Delete each attachment (storage files + mirrored copies)
    if (docs && docs.length > 0) {
      for (const doc of docs) {
        try {
          // Delete from task_documents table
          const { error: taskDocDeleteError } = await fromDynamicTable('task_documents').delete().eq('id', doc.id);
          if (taskDocDeleteError) {
            failures.push(`doc ${doc.id}: failed to delete task_documents row (${taskDocDeleteError.message})`);
          }

          // Delete from task_documents storage
          const { error: taskStorageDeleteError } = await supabase.storage.from('task_documents').remove([doc.file_path]);
          if (taskStorageDeleteError) {
            failures.push(`doc ${doc.id}: failed to delete task_documents file (${taskStorageDeleteError.message})`);
          }

          // Extract safeName for mirror cleanup
          const basename = doc.file_path.split('/').pop() || '';
          const underscoreIdx = basename.indexOf('_');
          const originalSafeName = underscoreIdx >= 0 ? basename.slice(underscoreIdx + 1) : basename;
          const safeName = sanitizeFileName(originalSafeName);

          // Clean up mirrored copy in job_documents
          if (task?.job_id) {
            const jobPath = `${department}/${task.job_id}/task-${id}/${safeName}`;
            const { error: jobDocDeleteError } = await supabase.from('job_documents').delete().eq('file_path', jobPath);
            if (jobDocDeleteError) {
              failures.push(`doc ${doc.id}: failed to delete job_documents row (${jobDocDeleteError.message})`);
            }
            const { error: jobStorageDeleteError } = await supabase.storage.from('job_documents').remove([jobPath]);
            if (jobStorageDeleteError) {
              failures.push(`doc ${doc.id}: failed to delete job_documents file (${jobStorageDeleteError.message})`);
            }
          }

          // Clean up mirrored copy in tour_documents
          if (task?.tour_id) {
            const tourPath = `schedules/${task.tour_id}/task-${id}/${safeName}`;
            const { error: tourDocDeleteError } = await supabase.from('tour_documents').delete().eq('file_path', tourPath);
            if (tourDocDeleteError) {
              failures.push(`doc ${doc.id}: failed to delete tour_documents row (${tourDocDeleteError.message})`);
            }
            const { error: tourStorageDeleteError } = await supabase.storage.from('tour-documents').remove([tourPath]);
            if (tourStorageDeleteError) {
              failures.push(`doc ${doc.id}: failed to delete tour-documents file (${tourStorageDeleteError.message})`);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push(`doc ${doc.id}: unexpected cleanup failure (${message})`);
        }
      }
    }

    // Finally, delete the task row
    const { error } = await fromDynamicTable(table).delete().eq('id', id);
    if (error) {
      failures.push(`task ${id}: failed to delete task row (${error.message})`);
    }

    if (failures.length > 0) {
      const aggregatedError = new Error(
        `Task deletion completed with ${failures.length} failure(s): ${failures.join('; ')}`,
      ) as Error & { failures: string[] };
      aggregatedError.failures = failures;
      throw aggregatedError;
    }
  };

  const assignUser = async (id: string, userId: string | null): Promise<AssignUserResult> => {
    const { data: authData } = await supabase.auth.getUser();
    const assignerId = authData?.user?.id ?? null;

    const { data: currentTask, error: currentTaskError } = await fromDynamicTable(table)
      .select<TaskMutationRow[]>('id, task_type, job_id, tour_id, assigned_to, created_by')
      .eq('id', id)
      .maybeSingle();
    if (currentTaskError) throw currentTaskError;
    if (!currentTask) throw new Error('Task not found');

    if ((currentTask.assigned_to ?? null) === userId) {
      return { status: 'no_change', taskId: id, userId };
    }

    if (userId) {
      let conflictQuery = fromDynamicTable(table)
        .select<Array<Pick<TaskMutationRow, 'id'>>>('id')
        .eq('task_type', currentTask.task_type)
        .eq('assigned_to', userId)
        .neq('id', id)
        .limit(1);

      conflictQuery = currentTask.job_id ? conflictQuery.eq('job_id', currentTask.job_id) : conflictQuery.is('job_id', null);
      conflictQuery = currentTask.tour_id ? conflictQuery.eq('tour_id', currentTask.tour_id) : conflictQuery.is('tour_id', null);

      const { data: conflictTask, error: conflictError } = await conflictQuery.maybeSingle();
      if (conflictError) throw conflictError;

      if (conflictTask?.id) {
        return {
          status: 'already_assigned',
          taskId: id,
          userId,
          conflictTaskId: conflictTask.id,
          taskType: currentTask.task_type ?? null,
          jobId: currentTask.job_id ?? null,
          tourId: currentTask.tour_id ?? null,
        };
      }
    }

    const { data, error } = await fromDynamicTable(table)
      .update({ assigned_to: userId, updated_at: nowUTC() })
      .eq('id', id)
      .select<Array<Pick<TaskMutationRow, 'id' | 'task_type' | 'created_by'>>>('id, task_type, created_by')
      .maybeSingle();
    if (error) {
      if (userId && isTaskAssigneeUniqueConflict(error)) {
        return {
          status: 'already_assigned',
          taskId: id,
          userId,
          taskType: currentTask.task_type ?? null,
          jobId: currentTask.job_id ?? null,
          tourId: currentTask.tour_id ?? null,
        };
      }
      throw error;
    }
    if (!data) throw new Error('Task not found or update not permitted');

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

    return { status: 'updated', taskId: id, userId };
  };

  const setStatus = async (id: string, status: 'not_started' | 'in_progress' | 'completed') => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id ?? null;

    const { data: task } = await fromDynamicTable(table)
      .select<TaskMutationRow[]>('id, task_type, assigned_to, created_by, job_id, tour_id')
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
    const { error } = await fromDynamicTable(table)
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
    if (jobId != null && tourId != null) {
      throw new Error('Validation error: job_id and tour_id are mutually exclusive');
    }

    // Get the previous link state so we can clean up old mirrors
    const { data: prevTask } = await fromDynamicTable(table)
      .select<Pick<TaskMutationRow, 'job_id' | 'tour_id'>[]>('job_id, tour_id')
      .eq('id', id)
      .maybeSingle();

    const { error } = await fromDynamicTable(table)
      .update({ job_id: jobId, tour_id: tourId, updated_at: nowUTC() })
      .eq('id', id);
    if (error) throw error;

    // Fetch existing task documents
    const { data: taskDocs } = await fromDynamicTable('task_documents')
      .select<Array<Pick<TaskDocumentRow, 'id' | 'file_name' | 'file_path'>>>('id, file_name, file_path')
      .eq(docFk, id);

    const docs = taskDocs || [];

    // Clean up old mirrors from previous link
    if (prevTask?.job_id && prevTask.job_id !== jobId) {
      for (const doc of docs) {
        try {
          const mirrorPath = `${department}/${prevTask.job_id}/task-${id}/${sanitizeFileName(doc.file_name)}`;
          const { error: jobDocDeleteError } = await supabase
            .from('job_documents')
            .delete()
            .eq('file_path', mirrorPath);
          if (jobDocDeleteError) throw jobDocDeleteError;

          const { error: jobStorageDeleteError } = await supabase.storage
            .from('job_documents')
            .remove([mirrorPath]);
          if (jobStorageDeleteError) throw jobStorageDeleteError;
        } catch (e) {
          console.warn('[useGlobalTaskMutations] old job mirror cleanup failed', e);
        }
      }
    }
    if (prevTask?.tour_id && prevTask.tour_id !== tourId) {
      for (const doc of docs) {
        try {
          const mirrorPath = `schedules/${prevTask.tour_id}/task-${id}/${sanitizeFileName(doc.file_name)}`;
          const { error: tourDocDeleteError } = await supabase
            .from('tour_documents')
            .delete()
            .eq('file_path', mirrorPath);
          if (tourDocDeleteError) throw tourDocDeleteError;

          const { error: tourStorageDeleteError } = await supabase.storage
            .from('tour-documents')
            .remove([mirrorPath]);
          if (tourStorageDeleteError) throw tourStorageDeleteError;
        } catch (e) {
          console.warn('[useGlobalTaskMutations] old tour mirror cleanup failed', e);
        }
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
    const { data: authData } = await supabase.auth.getUser();
    const uploaderId = authData?.user?.id;
    if (!uploaderId) throw new Error('User must be authenticated to upload attachments');

    const safeName = sanitizeFileName(file.name);
    const jobId = context?.jobId ?? null;
    const tourId = context?.tourId ?? null;

    // 1. Always store in task_documents bucket + table
    const taskKey = `${taskId}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage
      .from('task_documents')
      .upload(taskKey, file, { upsert: false });
    if (upErr) throw upErr;

    const { error: insErr } = await fromDynamicTable('task_documents').insert({
      [docFk]: taskId,
      file_name: file.name,
      file_path: taskKey,
      uploaded_by: uploaderId,
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
    createTaskForDepartment,
    createTasksForUsers,
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
