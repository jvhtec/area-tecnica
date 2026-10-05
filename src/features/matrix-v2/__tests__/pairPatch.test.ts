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
    const snapshot = snapshotMatrixCaches(queryClient);

    patchMatrixCaches(queryClient, { jobId: JOB_A, technicianId: TECH_1 }, view({ dates: ['2026-10-14', '2026-10-15'] }), getJob);
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
});

// Keeps makeRow referenced for the fixture contract.
void makeRow;
