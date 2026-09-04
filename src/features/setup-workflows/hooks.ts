import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/react-query';
import * as service from './service';
import { SetupWorkflowError, workflowErrorMessages } from './errors';
import type { JsonObject, SetupDepartment, TaskStatus, WorkflowStatus, WorkflowType } from './types';

export const setupWorkflowKeys = {
  all: queryKeys.scope('setup-workflows'),
  detail: (id?: string) => queryKeys.scope('setup-workflows', 'detail', id),
  tasks: (id?: string) => queryKeys.scope('setup-workflows', 'tasks', id),
  entity: (type: WorkflowType, id?: string) => queryKeys.scope('setup-workflows', 'entity', type, id),
};

export function useSetupWorkflow(id?: string) {
  return useQuery({
    queryKey: setupWorkflowKeys.detail(id), enabled: Boolean(id),
    queryFn: () => service.getWorkflow(id!),
  });
}

export function useSetupWorkflowTasks(id?: string) {
  return useQuery({
    queryKey: setupWorkflowKeys.tasks(id), enabled: Boolean(id),
    queryFn: () => service.getWorkflowTasks(id!),
  });
}

export function useSetupWorkflowForEntity(type: WorkflowType, entityId?: string) {
  return useQuery({
    queryKey: setupWorkflowKeys.entity(type, entityId), enabled: Boolean(entityId),
    queryFn: () => service.getWorkflowForEntity(type, entityId!),
  });
}

function useWorkflowMutationFeedback() {
  const client = useQueryClient();
  const { toast } = useToast();
  return {
    onSuccess: () => client.invalidateQueries({ queryKey: setupWorkflowKeys.all }),
    // A lost response can still mean the transaction committed; refetch on error
    // so a retry cannot rely on stale lifecycle or task statuses.
    onError: (error: Error) => {
      void client.invalidateQueries({ queryKey: setupWorkflowKeys.all });
      toast({
        title: 'No se pudo guardar la preparación',
        description: error instanceof SetupWorkflowError ? error.message : workflowErrorMessages.persistence,
        variant: 'destructive',
      });
    },
  };
}

export function useCreateSetupWorkflow() {
  const feedback = useWorkflowMutationFeedback();
  return useMutation({ mutationFn: service.createWorkflow, ...feedback });
}

export type WorkflowUpdate =
  | { action: 'state'; state: JsonObject }
  | { action: 'step'; step: string }
  | { action: 'status'; status: WorkflowStatus }
  | { action: 'task_status'; taskKey: string; status: TaskStatus }
  | { action: 'sync'; departments: readonly SetupDepartment[] };

export function useUpdateSetupWorkflow(workflowId: string) {
  const feedback = useWorkflowMutationFeedback();
  return useMutation({
    mutationFn: (update: WorkflowUpdate) => {
      switch (update.action) {
        case 'state': return service.updateWorkflowState(workflowId, update.state);
        case 'step': return service.setCurrentStep(workflowId, update.step);
        case 'status': return service.updateWorkflowStatus(workflowId, update.status);
        case 'task_status': return service.updateTaskStatus(workflowId, update.taskKey, update.status);
        case 'sync': return service.syncGeneratedTasks(workflowId, update.departments);
      }
    },
    ...feedback,
  });
}
