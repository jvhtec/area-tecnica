import { describe, expect, it } from 'vitest';
import { filterAssignmentsByDate } from '../calendarAssignmentUtils';
import type { PersonalCalendarAssignment } from '../usePersonalCalendarData';

describe('calendarAssignmentUtils', () => {
  const baseAssignment = {
    sound_role: null,
    lights_role: null,
    video_role: null,
    is_schedule_only: false,
    job: {
      id: 'job-1',
      title: 'Job',
      color: '#fff',
      start_time: '2025-04-01T08:00:00Z',
      end_time: '2025-04-01T18:00:00Z',
      status: 'confirmed',
      location: { name: 'HQ' },
    },
  } satisfies Omit<PersonalCalendarAssignment, 'technician_id' | 'date'>;

  const assignments: PersonalCalendarAssignment[] = [
    { ...baseAssignment, technician_id: 'tech-1', date: '2025-04-01' },
    { ...baseAssignment, technician_id: 'tech-2', date: '2025-04-02', job: { ...baseAssignment.job, id: 'job-2', title: 'Day 2' } },
    { ...baseAssignment, technician_id: 'tech-1', date: '2025-04-03', job: { ...baseAssignment.job, id: 'job-3', title: 'Day 3' } },
  ];

  it('returns only assignments scheduled for the provided day key', () => {
    const result = filterAssignmentsByDate(assignments, new Date('2025-04-02T00:00:00Z'));
    expect(result).toHaveLength(1);
    expect(result[0]?.technician_id).toBe('tech-2');
    expect(result[0]?.job.title).toBe('Day 2');
  });

  it('returns an empty array when no assignments match the day', () => {
    const result = filterAssignmentsByDate(assignments, new Date('2025-04-05T00:00:00Z'));
    expect(result).toHaveLength(0);
  });
});
