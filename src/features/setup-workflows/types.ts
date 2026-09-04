import type { Json } from '@/integrations/supabase/types';
import type { Department } from '@/types/department';
import { ESTRUCTURA_DEPARTMENT } from '@/domain/estructura';

export type WorkflowType = 'job' | 'tour' | 'tour_date';
export type WorkflowStatus = 'draft' | 'in_progress' | 'review' | 'complete' | 'cancelled';
export type TaskStatus = 'pending' | 'completed' | 'skipped' | 'blocked';
export type ResponsibleRole = 'assistant' | 'technical' | 'production' | 'management';
export type SetupDepartment = Extract<Department, 'sound' | 'lights' | 'video' | 'production' | 'personnel'> | typeof ESTRUCTURA_DEPARTMENT;
export type JsonObject = { [key: string]: Json | undefined };

export type SetupWorkflow = {
  id: string;
  type: WorkflowType;
  entity_id: string;
  job_id: string | null;
  tour_id: string | null;
  tour_date_id: string | null;
  status: WorkflowStatus;
  current_step: string;
  assigned_to: string | null;
  created_by: string | null;
  state: JsonObject;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type GeneratedTask = {
  task_key: string;
  category: string;
  label: string;
  required: boolean;
  responsible_role: ResponsibleRole;
  metadata: JsonObject;
};

export type SetupWorkflowTask = GeneratedTask & {
  id: string;
  workflow_id: string;
  status: TaskStatus;
  applicable: boolean;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GenerateTasksInput = {
  workflowType: WorkflowType;
  departments: readonly SetupDepartment[];
};

export type WorkflowSnapshot = { workflow: SetupWorkflow; tasks: SetupWorkflowTask[] };
