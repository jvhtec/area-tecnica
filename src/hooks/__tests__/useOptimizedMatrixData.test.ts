import { describe, expect, it } from 'vitest';
import {
  buildAssignmentDateMap,
  buildSeasonalAvailabilityKey,
  matrixAssignmentsQueryKey,
  matrixAvailabilityQueryKey,
} from '../useOptimizedMatrixData';

const createDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('buildAssignmentDateMap', () => {
  it('maps timesheet-backed assignment rows by technician and date', () => {
    const assignments: any[] = [
      {
        job_id: 'job-a',
        technician_id: 'tech-a',
        date: '2025-03-01',
        sound_role: 'mix',
        job: {
          id: 'job-a',
          title: 'Main Show',
          start_time: '2025-03-01T08:00:00Z',
          end_time: '2025-03-03T23:00:00Z',
        },
      },
      {
        job_id: 'job-a',
        technician_id: 'tech-a',
        date: '2025-03-02',
        sound_role: 'mix',
        job: {
          id: 'job-a',
          title: 'Main Show',
          start_time: '2025-03-01T08:00:00Z',
          end_time: '2025-03-03T23:00:00Z',
        },
      },
      {
        job_id: 'job-a',
        technician_id: 'tech-a',
        date: '2025-03-03',
        sound_role: 'mix',
        job: {
          id: 'job-a',
          title: 'Main Show',
          start_time: '2025-03-01T08:00:00Z',
          end_time: '2025-03-03T23:00:00Z',
        },
      },
      {
        job_id: 'job-b',
        technician_id: 'tech-b',
        date: '2025-03-02',
        lights_role: 'lx-lead',
        job: {
          id: 'job-b',
          title: 'Support Day',
          start_time: '2025-03-02T09:00:00Z',
          end_time: '2025-03-02T18:00:00Z',
        },
      },
    ];

    const dates = [createDate('2025-03-01'), createDate('2025-03-02'), createDate('2025-03-03')];
    const map = buildAssignmentDateMap(assignments as any, dates);

    expect(map.get('tech-a-2025-03-01')).toBe(assignments[0]);
    expect(map.get('tech-a-2025-03-02')).toBe(assignments[1]);
    expect(map.get('tech-a-2025-03-03')).toBe(assignments[2]);

    expect(map.get('tech-b-2025-03-02')).toBe(assignments[3]);
    expect(map.get('tech-b-2025-03-01')).toBeUndefined();
    expect(map.get('tech-b-2025-03-03')).toBeUndefined();
  });
});

describe('matrix query key builders', () => {
  it('keys assignments and availability on Madrid calendar days', () => {
    // 22:30 UTC on 31 May is already 1 June in Madrid (CEST).
    const start = new Date('2026-05-31T22:30:00Z');
    const end = new Date('2026-06-14T10:00:00Z');

    expect(matrixAssignmentsQueryKey(['job-a'], ['tech-a'], start, end)).toEqual([
      'optimized-matrix-assignments',
      ['job-a'],
      ['tech-a'],
      '2026-06-01',
      '2026-06-14',
    ]);

    expect(matrixAvailabilityQueryKey(['tech-a'], 'seasonal-key', start, end)).toEqual([
      'optimized-matrix-availability',
      ['tech-a'],
      'seasonal-key',
      '2026-06-01',
      '2026-06-14',
    ]);
  });
});

type SeasonalKeyInput = Parameters<typeof buildSeasonalAvailabilityKey>[0][number];

describe('buildSeasonalAvailabilityKey', () => {
  it('covers only seasonal house techs and is order-independent', () => {
    const seasonal: SeasonalKeyInput = {
      id: 'tech-a',
      role: 'house_tech',
      seasonal_house_tech: true,
      seasonal_house_tech_start_date: '2026-06-01',
      seasonal_house_tech_end_date: '2026-09-30',
    };
    const other: SeasonalKeyInput = {
      id: 'tech-b',
      role: 'technician',
      seasonal_house_tech: false,
      seasonal_house_tech_start_date: null,
      seasonal_house_tech_end_date: null,
    };

    const key = buildSeasonalAvailabilityKey([seasonal, other]);

    expect(key).toBe('tech-a:house_tech:2026-06-01:2026-09-30');
    expect(buildSeasonalAvailabilityKey([other, seasonal])).toBe(key);

    // A changed seasonal window has to produce a different cache entry.
    expect(
      buildSeasonalAvailabilityKey([{ ...seasonal, seasonal_house_tech_end_date: '2026-10-31' }]),
    ).not.toBe(key);
  });
});
