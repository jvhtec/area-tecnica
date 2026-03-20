import { describe, expect, it } from 'vitest';
import { buildJobsDataQueryKey, mergeRealtimeJobEvent } from '@/hooks/useJobsData';

describe('useJobsData helpers', () => {
  it('produces identical query keys for identical filters', () => {
    const start = new Date('2026-01-02T10:00:00.000Z');
    const end = new Date('2026-01-09T10:00:00.000Z');

    const keyA = buildJobsDataQueryKey({
      department: 'sound' as any,
      startDate: start,
      endDate: end,
      includeDryhire: true,
    });

    const keyB = buildJobsDataQueryKey({
      department: 'sound' as any,
      startDate: new Date('2026-01-02T10:00:00.000Z'),
      endDate: new Date('2026-01-09T10:00:00.000Z'),
      includeDryhire: true,
    });

    expect(keyA).toEqual(keyB);
  });

  it('merges realtime updates into cached jobs correctly', () => {
    const initial = [
      { id: 'job-1', title: 'Job 1' },
      { id: 'job-2', title: 'Job 2' },
    ];

    const afterInsert = mergeRealtimeJobEvent(initial, 'INSERT', {
      new: { id: 'job-3', title: 'Job 3' },
    });
    expect(afterInsert.map((job) => job.id)).toEqual(['job-1', 'job-2', 'job-3']);

    const afterUpdate = mergeRealtimeJobEvent(afterInsert, 'UPDATE', {
      new: { id: 'job-2', title: 'Job 2 updated' },
    });
    expect(afterUpdate.find((job) => job.id === 'job-2')?.title).toBe('Job 2 updated');

    const afterDelete = mergeRealtimeJobEvent(afterUpdate, 'DELETE', {
      old: { id: 'job-1', title: 'Job 1' },
    });
    expect(afterDelete.map((job) => job.id)).toEqual(['job-3', 'job-2']);
  });

  it('keeps loading/error shape compatible for consumers', () => {
    const previousData = [{ id: 'job-1' }];
    const afterFailedRealtimeUpdate = mergeRealtimeJobEvent(previousData, 'UPDATE', { new: null });
    expect(afterFailedRealtimeUpdate).toEqual(previousData);
    expect(Array.isArray(afterFailedRealtimeUpdate)).toBe(true);
  });
});
