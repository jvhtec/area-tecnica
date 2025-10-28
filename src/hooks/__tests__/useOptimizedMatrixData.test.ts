import { describe, expect, it } from 'vitest';
import { buildAssignmentDateMap } from '../useOptimizedMatrixData';

const createDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('buildAssignmentDateMap', () => {
  it('maps multi-day assignments across the visible range', () => {
    const assignments: any[] = [
      {
        job_id: 'job-a',
        technician_id: 'tech-a',
        sound_role: 'mix',
        single_day: false,
        single_day_date: null,
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
        lights_role: 'lx-lead',
        single_day: true,
        single_day_date: '2025-03-02',
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
    expect(map.get('tech-a-2025-03-02')).toBe(assignments[0]);
    expect(map.get('tech-a-2025-03-03')).toBe(assignments[0]);

    expect(map.get('tech-b-2025-03-02')).toBe(assignments[1]);
    expect(map.get('tech-b-2025-03-01')).toBeUndefined();
    expect(map.get('tech-b-2025-03-03')).toBeUndefined();
  });
});
