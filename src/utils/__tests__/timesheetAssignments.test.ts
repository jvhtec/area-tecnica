import { aggregateJobTimesheets, aggregateTimesheetsForJob, collapseConsecutiveDates } from '../timesheetAssignments';

describe('timesheetAssignments helpers', () => {
  it('collapses consecutive dates into ranges', () => {
    const ranges = collapseConsecutiveDates(['2025-01-01', '2025-01-02', '2025-01-04']);
    expect(ranges).toEqual([
      { start: '2025-01-01', end: '2025-01-02' },
      { start: '2025-01-04', end: '2025-01-04' },
    ]);
  });

  it('aggregates rows per job and technician, keeping assignment metadata', () => {
    const rows = [
      { job_id: 'job-1', technician_id: 'tech-1', date: '2025-03-01' },
      { job_id: 'job-1', technician_id: 'tech-1', date: '2025-03-02' },
      { job_id: 'job-1', technician_id: 'tech-2', date: '2025-03-05' },
      { job_id: 'job-2', technician_id: 'tech-3', date: '2025-03-06' },
    ];
    const assignmentsByJob = {
      'job-1': [
        {
          job_id: 'job-1',
          technician_id: 'tech-1',
          sound_role: 'ld1',
          profiles: { first_name: 'Ana', last_name: 'Lopez' },
        },
      ],
    };

    const aggregated = aggregateJobTimesheets(rows as any, assignmentsByJob as any);
    expect(aggregated['job-1']).toHaveLength(2);
    const tech1 = aggregated['job-1'].find((entry) => entry.technician_id === 'tech-1');
    expect(tech1?.sound_role).toBe('ld1');
    expect(tech1?.timesheet_dates).toEqual(['2025-03-01', '2025-03-02']);
    expect(tech1?.timesheet_ranges).toEqual([{ start: '2025-03-01', end: '2025-03-02' }]);

    const job2Entries = aggregated['job-2'];
    expect(job2Entries).toHaveLength(1);
    expect(job2Entries[0].technician_id).toBe('tech-3');
  });

  it('falls back to timesheet technician profile when assignment metadata is missing', () => {
    const rows = [
      {
        job_id: 'job-3',
        technician_id: 'tech-9',
        date: '2025-04-01',
        technician: { first_name: 'Leo', last_name: 'Sanchez' },
      },
    ];
    const aggregated = aggregateTimesheetsForJob('job-3', rows as any, []);
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].profiles).toEqual({ first_name: 'Leo', last_name: 'Sanchez' });
    expect(aggregated[0].timesheet_dates).toEqual(['2025-04-01']);
  });

  it('drops technicians once their per-day rows are deleted', () => {
    const rows = [
      { job_id: 'job-4', technician_id: 'tech-8', date: '2025-06-01' },
      { job_id: 'job-4', technician_id: 'tech-8', date: '2025-06-02' },
    ];

    const populated = aggregateTimesheetsForJob('job-4', rows as any, []);
    expect(populated).toHaveLength(1);
    expect(populated[0].timesheet_dates).toEqual(['2025-06-01', '2025-06-02']);

    const afterRemoval = aggregateTimesheetsForJob('job-4', [], []);
    expect(afterRemoval).toHaveLength(0);
  });
});
