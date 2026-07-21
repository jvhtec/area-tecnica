import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { Dept } from '@/utils/tasks';

type SoundTaskUpdate = Database['public']['Tables']['sound_job_tasks']['Update'];
type LightsTaskUpdate = Database['public']['Tables']['lights_job_tasks']['Update'];
type VideoTaskUpdate = Database['public']['Tables']['video_job_tasks']['Update'];
type ProductionTaskUpdate = Database['public']['Tables']['production_job_tasks']['Update'];
type AdministrativeTaskUpdate = Database['public']['Tables']['administrative_job_tasks']['Update'];
export type TaskDocumentInsert = Database['public']['Tables']['task_documents']['Insert'];
type TaskDocumentForeignKey = Extract<
  keyof TaskDocumentInsert,
  | 'sound_task_id'
  | 'lights_task_id'
  | 'video_task_id'
  | 'production_task_id'
  | 'administrative_task_id'
>;

export type TaskUpdate =
  | SoundTaskUpdate
  | LightsTaskUpdate
  | VideoTaskUpdate
  | ProductionTaskUpdate
  | AdministrativeTaskUpdate;

export type TaskTableName =
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
  insert<TData = unknown[]>(
    values: Record<string, unknown> | Array<Record<string, unknown>>,
  ): TaskFilterBuilder<TData>;
  delete<TData = unknown[]>(): TaskFilterBuilder<TData>;
}

export interface TaskMutationRow {
  id: string;
  task_type: string | null;
  assigned_to: string | null;
  created_by: string | null;
  job_id: string | null;
  tour_id: string | null;
}

export interface TaskDocumentRow {
  id: string;
  file_name: string;
  file_path: string;
  job_id?: string | null;
  tour_id?: string | null;
}

export const TASK_TABLE: Record<Dept, TaskTableName> = {
  sound: 'sound_job_tasks',
  lights: 'lights_job_tasks',
  video: 'video_job_tasks',
  production: 'production_job_tasks',
  administrative: 'administrative_job_tasks',
};

export const DOC_FK: Record<Dept, TaskDocumentForeignKey> = {
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

export const fromDynamicTable = (table: DynamicTableName) => dynamicSupabase.from(table);

export function nowUTC(): string {
  return new Date().toISOString();
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_');
}

export function resolveTaskDocBucket(filePath: string): string {
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
