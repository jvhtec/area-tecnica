// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useMemoizedMatrix } from '../useMemoizedMatrix';

describe('useMemoizedMatrix', () => {
  it('deduplicates dates that resolve to the same Madrid day and still indexes assignments/jobs correctly', () => {
    const assignment = {
      job_id: 'job-1',
      technician_id: 'tech-1',
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
});
