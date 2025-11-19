import { describe, expect, it } from 'vitest';
import { buildTechnicianAssignmentsFromTimesheets, TimesheetAssignmentRow, AssignmentMetadata } from '../TechnicianDashboard';

const baseJob = {
  id: 'job-1',
  title: 'Festival',
  description: 'Soundcheck',
  start_time: '2024-05-01T10:00:00Z',
  end_time: '2024-05-03T18:00:00Z',
  timezone: 'Europe/Madrid',
  location_id: 'loc-1',
  job_type: 'standard',
  color: '#FF0000',
  status: 'confirmed',
  location: { name: 'Main Hall' },
  job_documents: [],
};

describe('buildTechnicianAssignmentsFromTimesheets', () => {
  it('collapses contiguous timesheet dates into ranges per job', () => {
    const rows: TimesheetAssignmentRow[] = [
      { job_id: 'job-1', technician_id: 'tech-1', date: '2024-05-01', is_schedule_only: false, jobs: baseJob },
      { job_id: 'job-1', technician_id: 'tech-1', date: '2024-05-02', is_schedule_only: false, jobs: baseJob },
      { job_id: 'job-1', technician_id: 'tech-1', date: '2024-05-04', is_schedule_only: false, jobs: baseJob },
      { job_id: 'job-2', technician_id: 'tech-1', date: '2024-05-05', is_schedule_only: false, jobs: { ...baseJob, id: 'job-2' } },
    ];

    const metadata = new Map<string, AssignmentMetadata>([
      ['job-1:tech-1', { job_id: 'job-1', technician_id: 'tech-1', sound_role: 'SND-FOH-R', status: 'confirmed' }],
      ['job-2:tech-1', { job_id: 'job-2', technician_id: 'tech-1', lights_role: 'LGT-BRD-T', status: 'confirmed' }],
    ]);

    const assignments = buildTechnicianAssignmentsFromTimesheets(rows, metadata);

    expect(assignments).toHaveLength(2);

    const jobOne = assignments.find(a => a.job_id === 'job-1');
    expect(jobOne?.covered_dates).toEqual(['2024-05-01', '2024-05-02', '2024-05-04']);
    expect(jobOne?.date_ranges).toEqual([
      { start: '2024-05-01', end: '2024-05-02' },
      { start: '2024-05-04', end: '2024-05-04' },
    ]);

    const jobTwo = assignments.find(a => a.job_id === 'job-2');
    expect(jobTwo?.covered_dates).toEqual(['2024-05-05']);
    expect(jobTwo?.department).toBe('lights');
  });
});
