import { workflowClient } from './database';
import { assertWorkflowStep, getWorkflowDefinition } from './definitions';
import { SetupWorkflowError, workflowErrorMessages, type WorkflowErrorCode } from './errors';
import { generateWorkflowTasks } from './taskGeneration';
import type { GenerateTasksInput, JsonObject, SetupWorkflow, TaskStatus, WorkflowStatus, WorkflowType } from './types';

const errorCodes: readonly WorkflowErrorCode[] = [
  'unknown_type', 'invalid_transition', 'invalid_task_transition', 'missing_workflow',
  'missing_task', 'duplicate_workflow', 'incomplete_workflow', 'forbidden', 'invalid_input',
];

function persistenceError(error: { message: string; code?: string }): never {
  const code = errorCodes.find(value => error.message.startsWith(value + ':'))
    ?? (error.code === '42501' ? 'forbidden' : 'persistence');
  throw new SetupWorkflowError(code, workflowErrorMessages[code], error);
}

async function mutate(action: string, workflowId: string | undefined, payload: JsonObject) {
  const { data, error } = await workflowClient.rpc('mutate_setup_workflow', {
    p_action: action, p_workflow_id: workflowId, p_payload: payload,
  }).single();
  if (error) persistenceError(error);
  if (!data) throw new SetupWorkflowError('persistence', 'No se ha recibido la preparación guardada.');
  return data;
}

export type CreateWorkflowInput = GenerateTasksInput & {
  entityId: string;
  assignedTo?: string;
  state?: JsonObject;
};

/** Duplicate active creation is an explicit error; use getWorkflowForEntity to resume.
 * Creation + initial tasks commit atomically, so retry cannot leave orphan tasks.
 */
export function createWorkflow(input: CreateWorkflowInput) {
  const tasks = generateWorkflowTasks(input);
  return mutate('create', undefined, {
    type: input.workflowType, entity_id: input.entityId, assigned_to: input.assignedTo ?? null,
    state: input.state ?? {}, tasks,
  });
}

export async function getWorkflow(workflowId: string): Promise<SetupWorkflow> {
  const { data, error } = await workflowClient.from('setup_workflows').select('*').eq('id', workflowId).maybeSingle();
  if (error) persistenceError(error);
  if (!data) throw new SetupWorkflowError('missing_workflow', 'No se ha encontrado la preparación.');
  return data;
}

/** Optional by design: historical entities can legitimately have no workflow. */
export async function getWorkflowForEntity(type: WorkflowType, entityId: string) {
  getWorkflowDefinition(type);
  const { data, error } = await workflowClient.from('setup_workflows').select('*')
    .eq('type', type).eq('entity_id', entityId).in('status', ['draft', 'in_progress', 'review']).maybeSingle();
  if (error) persistenceError(error);
  return data;
}

export async function getWorkflowTasks(workflowId: string) {
  const { data, error } = await workflowClient.from('setup_workflow_tasks').select('*')
    .eq('workflow_id', workflowId).order('task_key');
  if (error) persistenceError(error);
  return data ?? [];
}

/** Resume is read-only, including archived workflows. Start is an explicit status
 * transition so reopening a tab cannot accidentally alter lifecycle state.
 */
export async function resumeWorkflow(workflowId: string) {
  const [workflow, tasks] = await Promise.all([getWorkflow(workflowId), getWorkflowTasks(workflowId)]);
  return { workflow, tasks };
}

export function updateWorkflowState(workflowId: string, state: JsonObject) {
  return mutate('state', workflowId, { state });
}

export async function setCurrentStep(workflowId: string, step: string) {
  const workflow = await getWorkflow(workflowId);
  assertWorkflowStep(workflow.type, step);
  return mutate('step', workflowId, { step });
}

// SQL validates these transitions under lock. Client-only read/check/write would
// race another session completing a task, synchronizing or closing the workflow.
export function updateWorkflowStatus(workflowId: string, status: WorkflowStatus) {
  return mutate('status', workflowId, { status });
}
export function updateTaskStatus(workflowId: string, taskKey: string, status: TaskStatus) {
  return mutate('task_status', workflowId, { task_key: taskKey, status });
}
export const completeTask = (id: string, taskKey: string) => updateTaskStatus(id, taskKey, 'completed');
export const skipTask = (id: string, taskKey: string) => updateTaskStatus(id, taskKey, 'skipped');
export const blockTask = (id: string, taskKey: string) => updateTaskStatus(id, taskKey, 'blocked');
export const completeWorkflow = (id: string) => updateWorkflowStatus(id, 'complete');
export const cancelWorkflow = (id: string) => updateWorkflowStatus(id, 'cancelled');

export async function syncGeneratedTasks(workflowId: string, departments: GenerateTasksInput['departments']) {
  const workflow = await getWorkflow(workflowId);
  const tasks = generateWorkflowTasks({ workflowType: workflow.type, departments });
  return mutate('sync', workflowId, { tasks });
}
