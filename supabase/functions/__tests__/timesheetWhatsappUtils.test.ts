import { describe, expect, it } from 'vitest';
import { selectTimesheetCrew, TimesheetCrewRow } from '../_shared/timesheetWhatsappUtils';

describe('selectTimesheetCrew', () => {
  const baseRows: TimesheetCrewRow[] = [
    {
      technician_id: 'tech-1',
      job_assignments: { sound_role: 'lead', lights_role: null, video_role: null },
      profile: { first_name: 'Ana', last_name: 'Lopez', phone: '+34111222333' },
    },
    {
      technician_id: 'tech-2',
      job_assignments: { sound_role: null, lights_role: 'ld', video_role: null },
      profile: { first_name: 'Bea', last_name: 'Perez', phone: '+34111222334' },
    },
  ];

  it('returns only technicians with matching department roles', () => {
    const result = selectTimesheetCrew(baseRows, 'sound');
    expect(result).toHaveLength(1);
    expect(result[0]?.technician_id).toBe('tech-1');
  });

  it('drops technicians once their last timesheet row disappears', () => {
    const withoutSecond: TimesheetCrewRow[] = [baseRows[0]!];
    const initial = selectTimesheetCrew(baseRows, 'lights');
    expect(initial).toHaveLength(1);
    const afterRemoval = selectTimesheetCrew(withoutSecond, 'lights');
    expect(afterRemoval).toHaveLength(0);
  });

  it('deduplicates technicians with multiple per-day rows', () => {
    const duplicated: TimesheetCrewRow[] = [
      baseRows[0]!,
      { ...baseRows[0]!, date: '2025-03-20' },
    ];
    const result = selectTimesheetCrew(duplicated, 'sound');
    expect(result).toHaveLength(1);
  });
});
