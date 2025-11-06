import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildAssignmentInsertPayload } from '../useJobAssignmentsRealtime';

describe('buildAssignmentInsertPayload', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalizes role values and defaults single-day fields', () => {
    const fixedDate = new Date('2025-03-01T12:00:00Z');
    vi.useFakeTimers().setSystemTime(fixedDate);

    const payload = buildAssignmentInsertPayload(
      'job-1',
      'tech-1',
      'none',
      'lx-main',
      'manager-1',
      undefined
    );

    expect(payload).toMatchObject({
      job_id: 'job-1',
      technician_id: 'tech-1',
      sound_role: null,
      lights_role: 'lx-main',
      assigned_by: 'manager-1',
      single_day: false,
      assignment_date: null,
    });
    expect(payload.assigned_at).toBe(fixedDate.toISOString());
  });

  it('captures single-day metadata when provided', () => {
    const fixedDate = new Date('2025-04-15T08:30:00Z');
    vi.useFakeTimers().setSystemTime(fixedDate);

    const payload = buildAssignmentInsertPayload(
      'job-2',
      'tech-99',
      'mix',
      'none',
      'manager-2',
      {
        singleDay: true,
        singleDayDate: '2025-04-20',
      }
    );

    expect(payload).toMatchObject({
      job_id: 'job-2',
      technician_id: 'tech-99',
      sound_role: 'mix',
      lights_role: null,
      assigned_by: 'manager-2',
      single_day: true,
      assignment_date: '2025-04-20',
    });
    expect(payload.assigned_at).toBe(fixedDate.toISOString());
  });
});
