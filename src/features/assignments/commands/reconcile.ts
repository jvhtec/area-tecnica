import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query';

export const assignmentCommandStateKey = (jobId: string, technicianId: string) =>
  queryKeys.scope('assignment-command-state', jobId, technicianId);

export const jobAssignmentCommandStatesKey = (jobId: string) =>
  queryKeys.scope('job-assignment-command-states', jobId);

/**
 * Refreshes every read model that shows a job/technician pair after a command
 * settles (committed, no-op or rejected-as-stale). The command result is the
 * authority; these refetches only bring other views up to date, so their order
 * does not matter.
 */
export function reconcileAssignmentViews(
  queryClient: QueryClient | null,
  { technicianId, jobIds }: { technicianId: string; jobIds: Array<string | null | undefined> },
) {
  const uniqueJobIds = Array.from(new Set(jobIds.filter((id): id is string => typeof id === 'string' && id.length > 0)));
  if (queryClient) {
    for (const jobId of uniqueJobIds) {
      void queryClient.invalidateQueries({ queryKey: assignmentCommandStateKey(jobId, technicianId) });
      void queryClient.invalidateQueries({ queryKey: jobAssignmentCommandStatesKey(jobId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.scope('existing-timesheets', jobId, technicianId) });
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.scope('optimized-jobs') });
    void queryClient.invalidateQueries({ queryKey: queryKeys.scope('jobs') });
  }
  // The matrix and job cards listen for this and refetch their own queries.
  for (const jobId of uniqueJobIds.length > 0 ? uniqueJobIds : [undefined]) {
    window.dispatchEvent(new CustomEvent('assignment-updated', { detail: { technicianId, jobId } }));
  }
}
