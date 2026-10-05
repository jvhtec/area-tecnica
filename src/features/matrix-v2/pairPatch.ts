import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { AssignmentCommandResult } from '@/features/assignments/commands';
import type { MatrixJob, MatrixTimesheetAssignment } from '@/hooks/useOptimizedMatrixData';
import { queryKeys } from '@/lib/react-query';
import type { RoleSlotAssignmentRow } from '@/features/matrix-v2/roleSlots';

/**
 * Cache patches for one job/technician pair.
 *
 * The runner paints a prediction the moment the manager acts, replaces it with
 * the exact outcome the command returned, and restores a snapshot when the
 * command is rejected. The refetch that follows stays the source of truth;
 * these patches only bridge the round trip.
 */

export const MATRIX_ASSIGNMENTS_SCOPE = 'optimized-matrix-assignments';
export const STAFFING_SUMMARY_SCOPE = 'matrix-staffing-summary';

export interface PairView {
  jobId: string;
  technicianId: string;
  /** Active days; the grid draws one cell per day. */
  dates: string[];
  status: string | null;
  roles: { sound: string | null; lights: string | null; video: string | null; production: string | null };
  singleDay: boolean;
  assignmentDate: string | null;
  assignedAt?: string | null;
  assignedBy?: string | null;
}

/** What a committed command left behind; null when the pair has no membership. */
export function pairViewFromResult(
  result: Pick<AssignmentCommandResult, 'job_id' | 'technician_id' | 'assignment' | 'dates'>,
): PairView | null {
  const { assignment } = result;
  if (!assignment) return null;
  return {
    jobId: result.job_id,
    technicianId: result.technician_id,
    dates: [...result.dates],
    status: assignment.status,
    roles: {
      sound: assignment.sound_role,
      lights: assignment.lights_role,
      video: assignment.video_role,
      production: assignment.production_role,
    },
    singleDay: assignment.single_day,
    assignmentDate: assignment.assignment_date,
  };
}

export interface MatrixQueryScopeInfo {
  jobsById: Map<string, MatrixJob>;
  technicianIds: Set<string>;
  startKey: string;
  endKey: string;
}

/** Reads what a cached matrix query covers off its key (see matrixAssignmentsQueryKey). */
export function readMatrixQueryScope(
  key: QueryKey,
  getJob: (jobId: string) => MatrixJob | undefined,
): MatrixQueryScopeInfo | null {
  const [, keyJobIds, keyTechnicianIds, startKey, endKey] = key;
  if (!Array.isArray(keyJobIds) || !Array.isArray(keyTechnicianIds)) return null;
  const jobsById = new Map<string, MatrixJob>();
  for (const id of keyJobIds) {
    if (typeof id !== 'string') continue;
    const job = getJob(id);
    if (job) jobsById.set(id, job);
  }
  return {
    jobsById,
    technicianIds: new Set(keyTechnicianIds.filter((id): id is string => typeof id === 'string')),
    startKey: typeof startKey === 'string' ? startKey : '',
    endKey: typeof endKey === 'string' ? endKey : '',
  };
}

/**
 * Replaces every row of the pair with one row per active day (or removes them
 * all when `pair` is null). Days outside the query's window, and technicians or
 * jobs it does not cover, are left out exactly as the query itself would.
 */
export function patchMatrixRows(
  rows: MatrixTimesheetAssignment[],
  ids: { jobId: string; technicianId: string },
  pair: PairView | null,
  scope: MatrixQueryScopeInfo,
): MatrixTimesheetAssignment[] {
  const isPairRow = (row: MatrixTimesheetAssignment) =>
    row.job_id === ids.jobId && row.technician_id === ids.technicianId;

  const previous = rows.filter(isPairRow);
  const others = previous.length === 0 ? rows : rows.filter((row) => !isPairRow(row));
  if (!pair) return previous.length === 0 ? rows : others;
  if (!scope.technicianIds.has(ids.technicianId)) return rows;

  const job = previous[0]?.job ?? rows.find((row) => row.job_id === ids.jobId)?.job ?? scope.jobsById.get(ids.jobId);
  if (!job) return rows;

  const previousByDate = new Map(previous.map((row) => [row.date, row]));
  const added: MatrixTimesheetAssignment[] = [];
  for (const date of pair.dates) {
    if (scope.startKey && date < scope.startKey) continue;
    if (scope.endKey && date > scope.endKey) continue;
    const before = previousByDate.get(date);
    added.push({
      job_id: ids.jobId,
      technician_id: ids.technicianId,
      date,
      job,
      status: pair.status,
      assigned_at: pair.assignedAt ?? before?.assigned_at ?? null,
      assigned_by: pair.assignedBy ?? before?.assigned_by ?? null,
      single_day: pair.singleDay && pair.dates.length === 1 && pair.assignmentDate === date,
      assignment_date: pair.assignmentDate,
      sound_role: pair.roles.sound,
      lights_role: pair.roles.lights,
      video_role: pair.roles.video,
      is_schedule_only: before?.is_schedule_only ?? null,
      source: before?.source ?? null,
    });
  }
  return [...others, ...added];
}

/** The page's staffing-summary query: required roles plus one row per membership. */
export interface StaffingSummaryPayload {
  summaries: unknown[];
  assignments: RoleSlotAssignmentRow[];
}

/** Keeps the role-slot bar in step with the pair (one row per membership). */
export function patchStaffingSummary(
  payload: StaffingSummaryPayload,
  ids: { jobId: string; technicianId: string },
  pair: PairView | null,
): StaffingSummaryPayload {
  const isPairRow = (row: RoleSlotAssignmentRow) =>
    row.job_id === ids.jobId && row.technician_id === ids.technicianId;
  const rest = payload.assignments.filter((row) => !isPairRow(row));
  if (!pair) {
    return rest.length === payload.assignments.length ? payload : { ...payload, assignments: rest };
  }
  const row: RoleSlotAssignmentRow = {
    job_id: ids.jobId,
    technician_id: ids.technicianId,
    status: pair.status,
    sound_role: pair.roles.sound,
    lights_role: pair.roles.lights,
    video_role: pair.roles.video,
    production_role: pair.roles.production,
  };
  return { ...payload, assignments: [...rest, row] };
}

export type CacheSnapshot = Array<[QueryKey, unknown]>;

const SNAPSHOT_SCOPES = [MATRIX_ASSIGNMENTS_SCOPE, STAFFING_SUMMARY_SCOPE];

export function snapshotMatrixCaches(queryClient: QueryClient): CacheSnapshot {
  return SNAPSHOT_SCOPES.flatMap((scope) =>
    queryClient.getQueriesData({ queryKey: queryKeys.scope(scope) }).map(([key, data]): [QueryKey, unknown] => [key, data]));
}

/** Puts back what the snapshot held, then lets the refetch settle the truth. */
export function restoreMatrixCaches(queryClient: QueryClient, snapshot: CacheSnapshot) {
  for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
  for (const scope of SNAPSHOT_SCOPES) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.scope(scope) });
  }
}

const isRowArray = (data: unknown): data is MatrixTimesheetAssignment[] => Array.isArray(data);

const isSummaryPayload = (data: unknown): data is StaffingSummaryPayload =>
  typeof data === 'object' && data !== null && 'assignments' in data && Array.isArray(data.assignments);

/** Applies a pair view to every cached matrix and staffing-summary query. */
export function patchMatrixCaches(
  queryClient: QueryClient,
  ids: { jobId: string; technicianId: string },
  pair: PairView | null,
  getJob: (jobId: string) => MatrixJob | undefined,
) {
  for (const [key, data] of queryClient.getQueriesData({ queryKey: queryKeys.scope(MATRIX_ASSIGNMENTS_SCOPE) })) {
    if (!isRowArray(data)) continue;
    const scope = readMatrixQueryScope(key, getJob);
    if (!scope) continue;
    const next = patchMatrixRows(data, ids, pair, scope);
    if (next !== data) queryClient.setQueryData(key, next);
  }
  for (const [key, data] of queryClient.getQueriesData({ queryKey: queryKeys.scope(STAFFING_SUMMARY_SCOPE) })) {
    if (!isSummaryPayload(data)) continue;
    const next = patchStaffingSummary(data, ids, pair);
    if (next !== data) queryClient.setQueryData(key, next);
  }
}
