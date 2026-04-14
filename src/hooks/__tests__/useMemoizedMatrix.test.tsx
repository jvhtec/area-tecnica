// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useMemoizedMatrix } from '../useMemoizedMatrix';

describe('useMemoizedMatrix', () => {
  it('deduplicates dates that resolve to the same Madrid day and still indexes assignments/jobs correctly', () => {
    const assignment = {
      job_id: 'job-1',
      technician_id: 'tech-1',
      date: '2026-04-14',
      status: 'confirmed',
      job: {
        id: 'job-1',
        title: 'Noche Madrid',
        start_time: '2026-04-13T23:30:00.000Z',
        end_time: '2026-04-14T04:00:00.000Z',
        color: '#0f172a',
      },
    };
    const job = {
      id: 'job-1',
      title: 'Noche Madrid',
      start_time: '2026-04-13T23:30:00.000Z',
      end_time: '2026-04-14T04:00:00.000Z',
      color: '#0f172a',
      status: 'Confirmado',
      job_type: 'single',
    };
    const duplicateMadridDayDates = [
      new Date('2026-04-13T23:30:00.000Z'),
      new Date('2026-04-14T00:15:00.000Z'),
    ];

    const { result } = renderHook(() =>
      useMemoizedMatrix([assignment], [], [job], duplicateMadridDayDates),
    );

    expect(result.current.assignmentLookup.size).toBe(1);
    expect(result.current.jobsByDate.size).toBe(1);
    expect(result.current.getAssignment('tech-1', new Date('2026-04-14T10:00:00.000Z'))).toEqual(assignment);
    expect(result.current.getJobsForDate(new Date('2026-04-14T10:00:00.000Z'))).toEqual([job]);
  });

  it('indexes assignments by exact timesheet date instead of expanding them across the job span', () => {
    const assignment = {
      job_id: 'job-1',
      technician_id: 'tech-1',
      date: '2026-04-14',
      status: 'confirmed',
      job: {
        id: 'job-1',
        title: 'Multi day job',
        start_time: '2026-04-14T08:00:00.000Z',
        end_time: '2026-04-16T22:00:00.000Z',
        color: '#0f172a',
      },
    };
    const job = {
      id: 'job-1',
      title: 'Multi day job',
      start_time: '2026-04-14T08:00:00.000Z',
      end_time: '2026-04-16T22:00:00.000Z',
      color: '#0f172a',
      status: 'Confirmado',
      job_type: 'single',
    };
    const dates = [
      new Date('2026-04-14T10:00:00.000Z'),
      new Date('2026-04-15T10:00:00.000Z'),
      new Date('2026-04-16T10:00:00.000Z'),
    ];

    const { result } = renderHook(() =>
      useMemoizedMatrix([assignment], [], [job], dates),
    );

    expect(result.current.getAssignment('tech-1', dates[0])).toEqual(assignment);
    expect(result.current.getAssignment('tech-1', dates[1])).toBeUndefined();
    expect(result.current.getAssignment('tech-1', dates[2])).toBeUndefined();
    expect(result.current.getJobsForDate(dates[1])).toEqual([job]);
  });
});
