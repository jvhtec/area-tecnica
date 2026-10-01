// @vitest-environment jsdom
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
const tables = vi.hoisted(() => ({ rows: {} as Record<string, Row[]>, ranges: [] as Array<[string, number, number]> }));

vi.mock('@/services/dataLayerClient', () => ({
  dataLayerClient: {
    from: vi.fn((table: string) => {
      const filters: Array<(row: Row) => boolean> = [];
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value);
          return builder;
        },
        in: (column: string, values: unknown[]) => {
          filters.push((row) => values.includes(row[column]));
          return builder;
        },
        order: () => builder,
        range: (from: number, to: number) => {
          tables.ranges.push([table, from, to]);
          const data = (tables.rows[table] ?? []).filter((row) => filters.every((f) => f(row))).slice(from, to + 1);
          return Promise.resolve({ data, error: null });
        },
      };
      return builder;
    }),
  },
}));

import { fetchJobSlotTotals, useMatrixHeaderCounts } from '../useMatrixHeaderCounts';
import { createTestQueryClient } from '@/test/createTestQueryClient';
import type { MatrixJob, MatrixTimesheetAssignment } from '@/hooks/useOptimizedMatrixData';

const job = (id: string, start: string, end: string): MatrixJob => ({
  id,
  title: id,
  start_time: `${start}T08:00:00.000Z`,
  end_time: `${end}T20:00:00.000Z`,
  status: 'Confirmado',
  job_type: 'single',
});

const day = (key: string) => new Date(`${key}T12:00:00.000Z`);

describe('fetchJobSlotTotals', () => {
  beforeEach(() => {
    tables.ranges.length = 0;
    tables.rows = {
      timesheets: [
        { id: 't1', job_id: 'a', technician_id: 'x', is_active: true },
        { id: 't2', job_id: 'a', technician_id: 'y', is_active: false },
      ],
      job_required_roles_summary: [
        { job_id: 'a', total_required: 3 },
        { job_id: 'a', total_required: 2 },
        { job_id: 'b', total_required: 4 },
      ],
      job_assignments: [
        // Scheduled: both of x's roles count.
        { job_id: 'a', technician_id: 'x', sound_role: 'FOH', lights_role: 'LX', video_role: null },
        // Only an inactive timesheet: not scheduled, does not count.
        { job_id: 'a', technician_id: 'y', sound_role: 'MON', lights_role: null, video_role: null },
      ],
    };
  });

  it('totals required slots and the roles held by scheduled technicians, per job', async () => {
    const totals = await fetchJobSlotTotals(['a', 'b']);
    expect(totals.get('a')).toEqual({ required: 5, assigned: 2 });
    expect(totals.get('b')).toEqual({ required: 4, assigned: 0 });
  });

  it('reads past the 1000-row page cap', async () => {
    tables.rows.timesheets = Array.from({ length: 1500 }, (_, i) => ({
      id: `t${i}`, job_id: 'a', technician_id: `tech-${i}`, is_active: true,
    }));
    tables.rows.job_assignments = [
      { job_id: 'a', technician_id: 'tech-1400', sound_role: 'FOH', lights_role: null, video_role: null },
    ];
    const totals = await fetchJobSlotTotals(['a']);
    // tech-1400 is only on the second page of timesheets.
    expect(totals.get('a')?.assigned).toBe(1);
    expect(tables.ranges.filter(([table]) => table === 'timesheets')).toEqual([
      ['timesheets', 0, 999],
      ['timesheets', 1000, 1999],
    ]);
  });
});

describe('useMatrixHeaderCounts', () => {
  const jobs = [job('a', '2026-03-10', '2026-03-11'), job('b', '2026-03-11', '2026-03-11')];
  const dates = [day('2026-03-10'), day('2026-03-11'), day('2026-03-12')];
  const getJobsForDate = (date: Date) =>
    date.toISOString().startsWith('2026-03-10') ? [jobs[0]] : date.toISOString().startsWith('2026-03-11') ? jobs : [];
  const assignment = (job_id: string, technician_id: string, date: string) =>
    ({ job_id, technician_id, date, job: jobs[0], status: 'confirmed', assigned_at: null }) as MatrixTimesheetAssignment;

  beforeEach(() => {
    tables.rows = {
      timesheets: [{ id: 't1', job_id: 'a', technician_id: 'x', is_active: true }],
      job_required_roles_summary: [{ job_id: 'a', total_required: 2 }, { job_id: 'b', total_required: 3 }],
      job_assignments: [{ job_id: 'a', technician_id: 'x', sound_role: 'FOH', lights_role: null, video_role: null }],
    };
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
  );

  it('counts confirmed technicians per day from the loaded timesheets, without a request', () => {
    const allAssignments = [
      assignment('a', 'x', '2026-03-10'),
      assignment('a', 'y', '2026-03-11'),
      assignment('b', 'y', '2026-03-11'),
      assignment('b', 'z', '2026-03-11'),
    ];
    const { result } = renderHook(
      () => useMatrixHeaderCounts({ dates, jobs, allAssignments, getJobsForDate, includeOpenSlots: false }),
      { wrapper },
    );
    expect(result.current(day('2026-03-10')).confirmed).toBe(1);
    // y is on two jobs that day and still counts once.
    expect(result.current(day('2026-03-11')).confirmed).toBe(2);
    expect(result.current(day('2026-03-12'))).toEqual({ confirmed: 0, openSlots: null });
  });

  it("sums the day's jobs' slot totals into open slots", async () => {
    const { result } = renderHook(
      () => useMatrixHeaderCounts({ dates, jobs, allAssignments: [], getJobsForDate, includeOpenSlots: true }),
      { wrapper },
    );
    await waitFor(() => expect(result.current(day('2026-03-11')).openSlots).not.toBeNull());
    expect(result.current(day('2026-03-10')).openSlots).toEqual({ required: 2, assigned: 1, open: 1 });
    expect(result.current(day('2026-03-11')).openSlots).toEqual({ required: 5, assigned: 1, open: 4 });
    expect(result.current(day('2026-03-12')).openSlots).toBeNull();
  });
});
