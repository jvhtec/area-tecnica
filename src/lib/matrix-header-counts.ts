import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/react-query';

/**
 * Date-header count scopes for the assignment matrix. These queries read
 * job_assignments, staffing_requests and timesheets, so every source of those
 * changes has to invalidate them — they are not kept fresh by a short
 * staleTime. Lives here rather than beside one of its callers so the matrix
 * hook, the matrix component and the staffing realtime handler can all reach it
 * without importing each other.
 */
export const MATRIX_HEADER_COUNT_SCOPES = [
  'matrix-date-confirmed-count',
  'matrix-open-slots',
  'matrix-job-engagement-counts',
] as const;

export const invalidateMatrixHeaderCounts = (queryClient: QueryClient) =>
  Promise.all(
    MATRIX_HEADER_COUNT_SCOPES.map((scope) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.scope(scope) }),
    ),
  );
