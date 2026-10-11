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

type PairIds = { jobId: string; technicianId: string };
type PairCacheRow = MatrixTimesheetAssignment | RoleSlotAssignmentRow;

interface PairCacheSnapshot {
  key: QueryKey;
  /** A removed/recreated query must never inherit an old operation's ownership. */
  query: object;
  kind: 'matrix' | 'staffing';
  before: PairCacheRow[];
  expected?: PairCacheRow[];
  expectedUpdateCount?: number;
}

export interface CacheSnapshot {
  ids?: PairIds;
  token: symbol;
  entries: PairCacheSnapshot[];
}

const SNAPSHOT_SCOPES = [MATRIX_ASSIGNMENTS_SCOPE, STAFFING_SUMMARY_SCOPE];
const pairOwners = new WeakMap<object, Map<string, symbol>>();
const pairPredictions = new WeakMap<object, Map<string, { ids: PairIds; entry: PairCacheSnapshot }>>();
const pairKey = (ids: PairIds) => JSON.stringify([ids.jobId, ids.technicianId]);
const matchesPair = (row: PairCacheRow, ids: PairIds) =>
  row.job_id === ids.jobId && row.technician_id === ids.technicianId;
const sameRows = (left: PairCacheRow[], right: PairCacheRow[]) =>
  left.length === right.length && left.every((row, index) => row === right[index]);

/** Carry untouched predictions across structural sharing caused by row moves. */
function setPairCacheData(queryClient: QueryClient, key: QueryKey, data: unknown) {
  const query = queryClient.getQueryCache().find({ queryKey: key, exact: true });
  const rows = isRowArray(data) ? data : isSummaryPayload(data) ? data.assignments : null;
  const preserved = rows && query ? [...(pairPredictions.get(query)?.values() ?? [])].filter(({ ids, entry }) =>
    entry.expected && sameRows(rows.filter((row) => matchesPair(row, ids)), entry.expected)) : [];
  queryClient.setQueryData(key, data);
  const stored = queryClient.getQueryData(key);
  const storedRows = isRowArray(stored) ? stored : isSummaryPayload(stored) ? stored.assignments : null;
  if (storedRows) {
    for (const { ids, entry } of preserved) {
      entry.expected = storedRows.filter((row) => matchesPair(row, ids));
      entry.expectedUpdateCount = queryClient.getQueryState(key)?.dataUpdateCount;
    }
  }
}

/**
 * Capture only this operation's pair. Pass the result as the fifth argument to
 * its optimistic patchMatrixCaches call, before awaiting the command. Omitted
 * ids capture nothing: unscoped callers can invalidate but cannot roll back.
 */
export function snapshotMatrixCaches(queryClient: QueryClient, ids?: PairIds): CacheSnapshot {
  const snapshot: CacheSnapshot = { ids: ids ? { ...ids } : undefined, token: Symbol('matrix-pair'), entries: [] };
  if (!ids) return snapshot;
  for (const scope of SNAPSHOT_SCOPES) {
    for (const [key, data] of queryClient.getQueriesData({ queryKey: queryKeys.scope(scope) })) {
      const query = queryClient.getQueryCache().find({ queryKey: key, exact: true });
      if (!query) continue;
      if (scope === MATRIX_ASSIGNMENTS_SCOPE && isRowArray(data)) {
        snapshot.entries.push({ key, query, kind: 'matrix', before: data.filter((row) => matchesPair(row, ids)) });
      } else if (scope === STAFFING_SUMMARY_SCOPE && isSummaryPayload(data)) {
        snapshot.entries.push({ key, query, kind: 'staffing', before: data.assignments.filter((row) => matchesPair(row, ids)) });
      }
    }
  }
  return snapshot;
}

/** Restore only rows still owned by the prediction; refetch settles the truth. */
export function restoreMatrixCaches(queryClient: QueryClient, snapshot: CacheSnapshot) {
  const { ids } = snapshot;
  if (ids) {
    const id = pairKey(ids);
    for (const entry of snapshot.entries) {
      const query = queryClient.getQueryCache().find({ queryKey: entry.key, exact: true });
      const owners = query ? pairOwners.get(query) : undefined;
      const expected = entry.expected;
      if (query !== entry.query || owners?.get(id) !== snapshot.token || !expected) continue;
      const data = queryClient.getQueryData(entry.key);
      const rows = entry.kind === 'matrix' && isRowArray(data)
        ? data : entry.kind === 'staffing' && isSummaryPayload(data) ? data.assignments : null;
      // A realtime/refetch writer changing the pair also loses ownership.
      // Absence has no row identity: an external write must also match revision.
      const ownsAbsence = expected.length > 0 || queryClient.getQueryState(entry.key)?.dataUpdateCount === entry.expectedUpdateCount;
      if (rows && ownsAbsence && sameRows(rows.filter((row) => matchesPair(row, ids)), expected)) {
        const restored = [...rows.filter((row) => !matchesPair(row, ids)), ...entry.before];
        setPairCacheData(queryClient, entry.key, entry.kind === 'matrix' ? restored : { ...data as StaffingSummaryPayload, assignments: restored });
      }
      owners?.delete(id);
      pairPredictions.get(query)?.delete(id);
    }
  }
  for (const scope of SNAPSHOT_SCOPES) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.scope(scope) });
  }
}

const isRowArray = (data: unknown): data is MatrixTimesheetAssignment[] => Array.isArray(data);

const isSummaryPayload = (data: unknown): data is StaffingSummaryPayload =>
  typeof data === 'object' && data !== null && 'assignments' in data && Array.isArray(data.assignments);

/** Even an identical/null committed patch supersedes the older prediction. */
function claimPairPatch(queryClient: QueryClient, key: QueryKey, ids: PairIds, snapshot?: CacheSnapshot) {
  const query = queryClient.getQueryCache().find({ queryKey: key, exact: true });
  if (!query) return;
  let owners = pairOwners.get(query);
  if (!owners) {
    owners = new Map();
    pairOwners.set(query, owners);
  }
  const entry = snapshot?.ids && pairKey(snapshot.ids) === pairKey(ids)
    ? snapshot.entries.find((candidate) => candidate.query === query) : undefined;
  owners.set(pairKey(ids), entry ? snapshot!.token : Symbol('matrix-pair'));
  if (!entry) {
    pairPredictions.get(query)?.delete(pairKey(ids));
    return;
  }
  let predictions = pairPredictions.get(query);
  if (!predictions) {
    predictions = new Map();
    pairPredictions.set(query, predictions);
  }
  predictions.set(pairKey(ids), { ids: { ...ids }, entry });
  const data = queryClient.getQueryData(key);
  const rows = entry.kind === 'matrix' && isRowArray(data)
    ? data : entry.kind === 'staffing' && isSummaryPayload(data) ? data.assignments : null;
  if (rows) entry.expected = rows.filter((row) => matchesPair(row, ids));
  entry.expectedUpdateCount = queryClient.getQueryState(key)?.dataUpdateCount;
}

/** Applies a pair view to every cached matrix and staffing-summary query. */
export function patchMatrixCaches(
  queryClient: QueryClient,
  ids: { jobId: string; technicianId: string },
  pair: PairView | null,
  getJob: (jobId: string) => MatrixJob | undefined,
  snapshot?: CacheSnapshot,
) {
  for (const [key, data] of queryClient.getQueriesData({ queryKey: queryKeys.scope(MATRIX_ASSIGNMENTS_SCOPE) })) {
    if (!isRowArray(data)) continue;
    const scope = readMatrixQueryScope(key, getJob);
    if (!scope) continue;
    const next = patchMatrixRows(data, ids, pair, scope);
    if (next !== data) setPairCacheData(queryClient, key, next);
    if (next !== data || pair === null) claimPairPatch(queryClient, key, ids, snapshot);
  }
  for (const [key, data] of queryClient.getQueriesData({ queryKey: queryKeys.scope(STAFFING_SUMMARY_SCOPE) })) {
    if (!isSummaryPayload(data)) continue;
    const next = patchStaffingSummary(data, ids, pair);
    if (next !== data) setPairCacheData(queryClient, key, next);
    if (next !== data || pair === null) claimPairPatch(queryClient, key, ids, snapshot);
  }
}
