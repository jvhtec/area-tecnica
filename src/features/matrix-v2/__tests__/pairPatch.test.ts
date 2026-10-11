import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import {
  MATRIX_ASSIGNMENTS_SCOPE,
  STAFFING_SUMMARY_SCOPE,
  pairViewFromResult,
  patchMatrixCaches,
  patchMatrixRows,
  patchStaffingSummary,
  readMatrixQueryScope,
  restoreMatrixCaches,
  snapshotMatrixCaches,
  type PairView,
} from '@/features/matrix-v2/pairPatch';
import { matrixAssignmentsQueryKey } from '@/hooks/useOptimizedMatrixData';
import { JOB_A, JOB_B, TECH_1, TECH_2, makeJob, makeMatrixRow, makeResult, makeRow } from '@/features/matrix-v2/__tests__/fixtures';

const scope = (overrides = {}) => ({
  jobsById: new Map([[JOB_A, makeJob(JOB_A)]]),
  technicianIds: new Set([TECH_1, TECH_2]),
  startKey: '2026-10-12',
  endKey: '2026-10-18',
  ...overrides,
});

const view = (overrides: Partial<PairView> = {}): PairView => ({
  jobId: JOB_A,
  technicianId: TECH_1,
  dates: ['2026-10-13', '2026-10-14'],
  status: 'invited',
  roles: { sound: 'SND-FOH-E', lights: null, video: null, production: null },
  singleDay: false,
  assignmentDate: null,
  ...overrides,
});

describe('pairViewFromResult', () => {
  it('reads the committed state', () => {
    expect(pairViewFromResult(makeResult())).toMatchObject({
      jobId: JOB_A, technicianId: TECH_1, dates: ['2026-10-13', '2026-10-14'], status: 'invited',
      roles: { sound: 'SND-FOH-E', production: null },
    });
  });
  it('is null when the pair has no membership', () => {
    expect(pairViewFromResult(makeResult({ assignment: null, dates: [] }))).toBeNull();
  });
});

describe('patchMatrixRows', () => {
  it('replaces the pair with one row per active day and leaves other pairs alone', () => {
    const other = makeMatrixRow({ technician_id: TECH_2, date: '2026-10-13' });
    const rows = [makeMatrixRow({ date: '2026-10-13' }), other];
    const next = patchMatrixRows(rows, { jobId: JOB_A, technicianId: TECH_1 }, view({ dates: ['2026-10-14', '2026-10-15'] }), scope());
    expect(next.filter((r) => r.technician_id === TECH_1).map((r) => r.date).sort()).toEqual(['2026-10-14', '2026-10-15']);
    expect(next).toContain(other);
  });

  it('keeps schedule metadata of a day that survives', () => {
    const rows = [makeMatrixRow({ date: '2026-10-13', is_schedule_only: true, source: 'tour' })];
    const next = patchMatrixRows(rows, { jobId: JOB_A, technicianId: TECH_1 }, view({ dates: ['2026-10-13'] }), scope());
    expect(next[0]).toMatchObject({ is_schedule_only: true, source: 'tour' });
  });

  it('removes every row when the pair is gone, and returns the same array when there was nothing', () => {
    const rows = [makeMatrixRow({ date: '2026-10-13' }), makeMatrixRow({ date: '2026-10-14' })];
    expect(patchMatrixRows(rows, { jobId: JOB_A, technicianId: TECH_1 }, null, scope())).toEqual([]);
    const untouched = [makeMatrixRow({ technician_id: TECH_2 })];
    expect(patchMatrixRows(untouched, { jobId: JOB_A, technicianId: TECH_1 }, null, scope())).toBe(untouched);
  });

  it('stays inside what the query covers', () => {
    const next = patchMatrixRows([], { jobId: JOB_A, technicianId: TECH_1 }, view({ dates: ['2026-10-11', '2026-10-13', '2026-10-19'] }), scope());
    expect(next.map((r) => r.date)).toEqual(['2026-10-13']);
    const outsider = patchMatrixRows([], { jobId: JOB_A, technicianId: 'someone-else' }, view({ technicianId: 'someone-else' }), scope());
    expect(outsider).toEqual([]);
  });

  it('treats empty window keys as unbounded', () => {
    const next = patchMatrixRows([], { jobId: JOB_A, technicianId: TECH_1 }, view({ dates: ['2030-01-01'] }), scope({ startKey: '', endKey: '' }));
    expect(next).toHaveLength(1);
  });

  it('paints nothing for a job the query does not know', () => {
    const rows = [makeMatrixRow({ technician_id: TECH_2 })];
    const next = patchMatrixRows(rows, { jobId: JOB_B, technicianId: TECH_1 }, view({ jobId: JOB_B }), scope());
    expect(next).toBe(rows);
  });

  it('marks a lone scoped day as single-day only when it is that day', () => {
    const next = patchMatrixRows([], { jobId: JOB_A, technicianId: TECH_1 },
      view({ dates: ['2026-10-14'], singleDay: true, assignmentDate: '2026-10-14' }), scope());
    expect(next[0].single_day).toBe(true);
    const multi = patchMatrixRows([], { jobId: JOB_A, technicianId: TECH_1 },
      view({ dates: ['2026-10-13', '2026-10-14'], singleDay: true, assignmentDate: '2026-10-14' }), scope());
    expect(multi.every((r) => r.single_day === false)).toBe(true);
  });
});

describe('patchStaffingSummary', () => {
  const payload = {
    summaries: [],
    assignments: [
      { job_id: JOB_A, technician_id: TECH_1, sound_role: 'SND-PA-T', status: 'invited' },
      { job_id: JOB_A, technician_id: TECH_2, sound_role: 'SND-PA-T', status: 'confirmed' },
    ],
  };
  it('swaps the pair row and keeps the others', () => {
    const next = patchStaffingSummary(payload, { jobId: JOB_A, technicianId: TECH_1 }, view({ status: 'confirmed', roles: { sound: 'SND-FOH-R', lights: null, video: null, production: null } }));
    expect(next.assignments).toHaveLength(2);
    expect(next.assignments.find((r) => r.technician_id === TECH_1)).toMatchObject({ status: 'confirmed', sound_role: 'SND-FOH-R' });
  });
  it('drops the row on removal and keeps identity when nothing changes', () => {
    expect(patchStaffingSummary(payload, { jobId: JOB_A, technicianId: TECH_1 }, null).assignments).toHaveLength(1);
    expect(patchStaffingSummary(payload, { jobId: JOB_B, technicianId: TECH_1 }, null)).toBe(payload);
  });
});

describe('query cache integration', () => {
  const getJob = (id: string) => (id === JOB_A ? makeJob(JOB_A) : undefined);
  const key = matrixAssignmentsQueryKey([JOB_A], [TECH_1, TECH_2], new Date('2026-10-11T22:00:00Z'), new Date('2026-10-18T22:00:00Z'));

  it('reads its scope from the same key the matrix builds', () => {
    const parsed = readMatrixQueryScope(key, getJob);
    expect(parsed?.technicianIds).toEqual(new Set([TECH_1, TECH_2]));
    expect(parsed?.jobsById.has(JOB_A)).toBe(true);
    expect(parsed?.startKey).toBe('2026-10-12');
    expect(parsed?.endKey).toBe('2026-10-19');
    expect(key[0]).toBe(MATRIX_ASSIGNMENTS_SCOPE);
  });

  it('patches every matrix and summary query, and restores them from a snapshot', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(key, [makeMatrixRow({ date: '2026-10-13' })]);
    queryClient.setQueryData([STAFFING_SUMMARY_SCOPE, 'a,b'], { summaries: [], assignments: [] });
    const snapshot = snapshotMatrixCaches(queryClient, { jobId: JOB_A, technicianId: TECH_1 });

    patchMatrixCaches(queryClient, { jobId: JOB_A, technicianId: TECH_1 }, view({ dates: ['2026-10-14', '2026-10-15'] }), getJob, snapshot);
    const patched = queryClient.getQueryData<ReturnType<typeof makeMatrixRow>[]>(key) ?? [];
    expect(patched.map((r) => r.date).sort()).toEqual(['2026-10-14', '2026-10-15']);
    expect(queryClient.getQueryData<{ assignments: unknown[] }>([STAFFING_SUMMARY_SCOPE, 'a,b'])?.assignments).toHaveLength(1);

    restoreMatrixCaches(queryClient, snapshot);
    expect((queryClient.getQueryData<unknown[]>(key) ?? []).length).toBe(1);
    expect(queryClient.getQueryData<{ assignments: unknown[] }>([STAFFING_SUMMARY_SCOPE, 'a,b'])?.assignments).toHaveLength(0);
  });

  it('ignores queries with an unexpected shape', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData([MATRIX_ASSIGNMENTS_SCOPE, 'weird'], { not: 'rows' });
    queryClient.setQueryData([STAFFING_SUMMARY_SCOPE, 'weird'], 'nope');
    expect(() => patchMatrixCaches(queryClient, { jobId: JOB_A, technicianId: TECH_1 }, view(), getJob)).not.toThrow();
  });

  it('rolls back A without erasing B or newer staffing requirements', () => {
    const queryClient = new QueryClient();
    const ids = { jobId: JOB_A, technicianId: TECH_1 };
    const otherIds = { jobId: JOB_A, technicianId: TECH_2 };
    const summaryKey = [STAFFING_SUMMARY_SCOPE, 'a,b'];
    const original = makeMatrixRow({ assigned_at: 'original-time', assigned_by: 'manager', source: 'tour', is_schedule_only: true });
    queryClient.setQueryData(key, [original, makeMatrixRow({ technician_id: TECH_2 })]);
    queryClient.setQueryData(summaryKey, { summaries: [], assignments: [original] });
    const snapshot = snapshotMatrixCaches(queryClient, ids);
    patchMatrixCaches(queryClient, ids, view({ status: 'declined' }), getJob, snapshot);
    patchMatrixCaches(queryClient, otherIds, view({ technicianId: TECH_2, status: 'confirmed', dates: ['2026-10-15'] }), getJob);
    queryClient.setQueryData(summaryKey, (payload: { assignments: unknown[] }) => ({
      ...payload, summaries: [{ job_id: JOB_A, required: 5 }], refreshed: true,
    }));

    restoreMatrixCaches(queryClient, snapshot);
    const rows = queryClient.getQueryData<ReturnType<typeof makeMatrixRow>[]>(key)!;
    expect(rows.filter((row) => row.technician_id === TECH_1)).toEqual([original]);
    expect(rows.find((row) => row.technician_id === TECH_2)).toMatchObject({ status: 'confirmed', date: '2026-10-15' });
    expect(queryClient.getQueryData(summaryKey)).toMatchObject({
      summaries: [{ job_id: JOB_A, required: 5 }], refreshed: true,
      assignments: expect.arrayContaining([expect.objectContaining({ technician_id: TECH_2, status: 'confirmed' })]),
    });
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(summaryKey)?.isInvalidated).toBe(true);
  });

  it.each([false, true])('preserves a newer same-pair patch even when its values equal the prediction (%s)', (sameValues) => {
    const queryClient = new QueryClient();
    const ids = { jobId: JOB_A, technicianId: TECH_1 };
    const summaryKey = [STAFFING_SUMMARY_SCOPE, 'a,b'];
    queryClient.setQueryData(key, [makeMatrixRow()]);
    queryClient.setQueryData(summaryKey, { summaries: [], assignments: [makeMatrixRow()] });
    const snapshot = snapshotMatrixCaches(queryClient, ids);
    const prediction = view({ status: 'confirmed' });
    patchMatrixCaches(queryClient, ids, prediction, getJob, snapshot);
    patchMatrixCaches(queryClient, ids, sameValues ? prediction : view({ status: 'declined' }), getJob);
    const latestMatrix = queryClient.getQueryData(key);
    const latestSummary = queryClient.getQueryData(summaryKey);

    restoreMatrixCaches(queryClient, snapshot);
    expect(queryClient.getQueryData(key)).toBe(latestMatrix);
    expect(queryClient.getQueryData(summaryKey)).toBe(latestSummary);
  });

  it('preserves same-pair updates made outside the patch helper', () => {
    const queryClient = new QueryClient();
    const ids = { jobId: JOB_A, technicianId: TECH_1 };
    const summaryKey = [STAFFING_SUMMARY_SCOPE, 'a,b'];
    queryClient.setQueryData(key, [makeMatrixRow()]);
    queryClient.setQueryData(summaryKey, { summaries: [], assignments: [makeMatrixRow()] });
    const snapshot = snapshotMatrixCaches(queryClient, ids);
    patchMatrixCaches(queryClient, ids, view({ status: 'confirmed' }), getJob, snapshot);
    queryClient.setQueryData(key, [makeMatrixRow({ status: 'declined' })]);
    queryClient.setQueryData(summaryKey, { summaries: [], assignments: [makeMatrixRow({ status: 'declined' })] });
    restoreMatrixCaches(queryClient, snapshot);
    expect(queryClient.getQueryData(key)).toEqual([makeMatrixRow({ status: 'declined' })]);
    expect(queryClient.getQueryData(summaryKey)).toMatchObject({ assignments: [expect.objectContaining({ status: 'declined' })] });
  });

  it('restores a removed pair while preserving another pair commit', () => {
    const queryClient = new QueryClient();
    const ids = { jobId: JOB_A, technicianId: TECH_1 };
    const summaryKey = [STAFFING_SUMMARY_SCOPE, 'a,b'];
    const original = makeMatrixRow();
    queryClient.setQueryData(key, [original]);
    queryClient.setQueryData(summaryKey, { summaries: [], assignments: [original] });
    const snapshot = snapshotMatrixCaches(queryClient, ids);
    patchMatrixCaches(queryClient, ids, null, getJob, snapshot);
    patchMatrixCaches(queryClient, { jobId: JOB_A, technicianId: TECH_2 }, view({ technicianId: TECH_2, status: 'confirmed' }), getJob);
    restoreMatrixCaches(queryClient, snapshot);
    expect(queryClient.getQueryData(key)).toEqual(expect.arrayContaining([original, expect.objectContaining({ technician_id: TECH_2, status: 'confirmed' })]));
    expect(queryClient.getQueryData(summaryKey)).toMatchObject({ assignments: expect.arrayContaining([original, expect.objectContaining({ technician_id: TECH_2 })]) });
  });

  it.each(['helper', 'external'])('does not resurrect a newer absent pair written by %s', (writer) => {
    const queryClient = new QueryClient();
    const ids = { jobId: JOB_A, technicianId: TECH_1 };
    const summaryKey = [STAFFING_SUMMARY_SCOPE, 'a,b'];
    queryClient.setQueryData(key, [makeMatrixRow()]);
    queryClient.setQueryData(summaryKey, { summaries: [], assignments: [makeMatrixRow()] });
    const snapshot = snapshotMatrixCaches(queryClient, ids);
    patchMatrixCaches(queryClient, ids, null, getJob, snapshot);
    if (writer === 'helper') patchMatrixCaches(queryClient, ids, null, getJob);
    else {
      queryClient.setQueryData(key, []);
      queryClient.setQueryData(summaryKey, { summaries: [], assignments: [] });
    }
    restoreMatrixCaches(queryClient, snapshot);
    expect(queryClient.getQueryData(key)).toEqual([]);
    expect(queryClient.getQueryData(summaryKey)).toEqual({ summaries: [], assignments: [] });
  });

  it('removes a new predicted pair while keeping a concurrently added pair', () => {
    const queryClient = new QueryClient();
    const ids = { jobId: JOB_A, technicianId: TECH_1 };
    const summaryKey = [STAFFING_SUMMARY_SCOPE, 'a,b'];
    queryClient.setQueryData(key, []);
    queryClient.setQueryData(summaryKey, { summaries: [], assignments: [] });
    const snapshot = snapshotMatrixCaches(queryClient, ids);
    expect(snapshot.entries.every((entry) => entry.before.length === 0)).toBe(true);
    patchMatrixCaches(queryClient, ids, view(), getJob, snapshot);
    patchMatrixCaches(queryClient, { jobId: JOB_A, technicianId: TECH_2 }, view({ technicianId: TECH_2 }), getJob);
    restoreMatrixCaches(queryClient, snapshot);
    const rows = queryClient.getQueryData<ReturnType<typeof makeMatrixRow>[]>(key)!;
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.technician_id === TECH_2)).toBe(true);
    expect(queryClient.getQueryData(summaryKey)).toMatchObject({ assignments: [expect.objectContaining({ technician_id: TECH_2 })] });
  });

  it('restores each window from its pair-only snapshot and leaves out-of-scope queries alone', () => {
    const queryClient = new QueryClient();
    const ids = { jobId: JOB_A, technicianId: TECH_1 };
    const oneDayKey = [MATRIX_ASSIGNMENTS_SCOPE, [JOB_A], [TECH_1], '2026-10-14', '2026-10-14'];
    const outsiderKey = [MATRIX_ASSIGNMENTS_SCOPE, [JOB_A], [TECH_2], '2026-10-12', '2026-10-19'];
    const first = makeMatrixRow({ date: '2026-10-13' });
    const second = makeMatrixRow({ date: '2026-10-14', assigned_by: 'second-manager' });
    queryClient.setQueryData(key, [first, makeMatrixRow({ technician_id: TECH_2 })]);
    queryClient.setQueryData(oneDayKey, [second]);
    queryClient.setQueryData(outsiderKey, []);
    const snapshot = snapshotMatrixCaches(queryClient, ids);
    expect(snapshot.entries.flatMap((entry) => entry.before)).toEqual([first, second]);
    patchMatrixCaches(queryClient, ids, view({ dates: ['2026-10-15'] }), getJob, snapshot);
    restoreMatrixCaches(queryClient, snapshot);
    expect(queryClient.getQueryData(key)).toEqual(expect.arrayContaining([first]));
    expect(queryClient.getQueryData(oneDayKey)).toEqual([second]);
    expect(queryClient.getQueryData(outsiderKey)).toEqual([]);
  });

  it('leaves caches loaded after snapshot intact and does not recreate removed caches', () => {
    const queryClient = new QueryClient();
    const ids = { jobId: JOB_A, technicianId: TECH_1 };
    const summaryKey = [STAFFING_SUMMARY_SCOPE, 'a,b'];
    queryClient.setQueryData(key, [makeMatrixRow()]);
    const snapshot = snapshotMatrixCaches(queryClient, ids);
    queryClient.setQueryData(summaryKey, { summaries: ['new'], assignments: [] });
    patchMatrixCaches(queryClient, ids, view(), getJob, snapshot);
    const latest = queryClient.getQueryData(summaryKey);
    queryClient.removeQueries({ queryKey: key, exact: true });
    restoreMatrixCaches(queryClient, snapshot);
    expect(queryClient.getQueryState(key)).toBeUndefined();
    expect(queryClient.getQueryData(summaryKey)).toBe(latest);
    expect(queryClient.getQueryState(summaryKey)?.isInvalidated).toBe(true);
  });

  it('does not restore into a removed and recreated query', () => {
    const queryClient = new QueryClient();
    const ids = { jobId: JOB_A, technicianId: TECH_1 };
    queryClient.setQueryData(key, [makeMatrixRow()]);
    const snapshot = snapshotMatrixCaches(queryClient, ids);
    patchMatrixCaches(queryClient, ids, view(), getJob, snapshot);
    queryClient.removeQueries({ queryKey: key, exact: true });
    queryClient.setQueryData(key, [makeMatrixRow({ status: 'confirmed' })]);
    restoreMatrixCaches(queryClient, snapshot);
    expect(queryClient.getQueryData(key)).toEqual([makeMatrixRow({ status: 'confirmed' })]);
  });

  it('does not restore when no prediction claimed the snapshot or ids were omitted', () => {
    const queryClient = new QueryClient();
    const ids = { jobId: JOB_A, technicianId: TECH_1 };
    queryClient.setQueryData(key, [makeMatrixRow()]);
    const scoped = snapshotMatrixCaches(queryClient, ids);
    const unscoped = snapshotMatrixCaches(queryClient);
    patchMatrixCaches(queryClient, ids, view({ status: 'confirmed' }), getJob);
    const latest = queryClient.getQueryData(key);
    restoreMatrixCaches(queryClient, scoped);
    restoreMatrixCaches(queryClient, unscoped);
    expect(queryClient.getQueryData(key)).toBe(latest);
  });

  it('keeps ownership of another pending prediction when a different rollback moves its rows', () => {
    const queryClient = new QueryClient();
    const firstIds = { jobId: JOB_A, technicianId: TECH_1 };
    const secondIds = { jobId: JOB_A, technicianId: TECH_2 };
    const before = [makeMatrixRow(), makeMatrixRow({ technician_id: TECH_2 })];
    queryClient.setQueryData(key, before);
    const firstSnapshot = snapshotMatrixCaches(queryClient, firstIds);
    patchMatrixCaches(queryClient, firstIds, view({ status: 'confirmed' }), getJob, firstSnapshot);
    const secondSnapshot = snapshotMatrixCaches(queryClient, secondIds);
    patchMatrixCaches(queryClient, secondIds, view({ technicianId: TECH_2, status: 'declined' }), getJob, secondSnapshot);
    restoreMatrixCaches(queryClient, firstSnapshot);
    restoreMatrixCaches(queryClient, secondSnapshot);
    expect(queryClient.getQueryData(key)).toEqual(before);
  });
});

// Keeps makeRow referenced for the fixture contract.
void makeRow;
