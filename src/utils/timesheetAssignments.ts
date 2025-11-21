
export interface TimesheetRowWithTechnician {
  job_id: string;
  technician_id: string;
  date: string;
  is_schedule_only: boolean;
  technician: {
    id: string;
    first_name: string;
    last_name: string;
    nickname: string;
    department: string;
  };
}

export interface AggregatedTimesheetAssignment {
  technician_id: string;
  technician: {
    id: string;
    first_name: string;
    last_name: string;
    nickname: string;
    department: string;
  };
  dates: string[];
  status: string;
  source: 'assignment' | 'timesheet';
  roles: {
    sound_role?: string;
    lights_role?: string;
    video_role?: string;
  };
  original_assignment?: any;
}

export function aggregateJobTimesheets(
  timesheetRows: TimesheetRowWithTechnician[],
  assignmentLookup: Record<string, any[]>
): Record<string, AggregatedTimesheetAssignment[]> {
  const result: Record<string, AggregatedTimesheetAssignment[]> = {};

  // Group timesheets by job_id
  const timesheetsByJob: Record<string, TimesheetRowWithTechnician[]> = {};
  timesheetRows.forEach(row => {
    if (!timesheetsByJob[row.job_id]) {
      timesheetsByJob[row.job_id] = [];
    }
    timesheetsByJob[row.job_id].push(row);
  });

  // Process each job
  Object.keys(timesheetsByJob).forEach(jobId => {
    const jobTimesheets = timesheetsByJob[jobId];
    const existingAssignments = assignmentLookup[jobId] || [];
    const aggregatedAssignments: AggregatedTimesheetAssignment[] = [];

    // Group by technician
    const timesheetsByTech: Record<string, TimesheetRowWithTechnician[]> = {};
    jobTimesheets.forEach(row => {
      if (!timesheetsByTech[row.technician_id]) {
        timesheetsByTech[row.technician_id] = [];
      }
      timesheetsByTech[row.technician_id].push(row);
    });

    // Merge with existing assignments or create new ones
    Object.keys(timesheetsByTech).forEach(techId => {
      const techTimesheets = timesheetsByTech[techId];
      const existingAssignment = existingAssignments.find(a => a.technician_id === techId);
      
      // Use the first timesheet row to get technician details if no assignment exists
      // Fallback to empty object if technician is null (shouldn't happen with inner join but safety first)
      const techDetails = existingAssignment?.profiles || techTimesheets[0].technician || {
        id: techId,
        first_name: 'Unknown',
        last_name: 'Technician',
        nickname: '',
        department: ''
      };

      const aggregated: AggregatedTimesheetAssignment = {
        technician_id: techId,
        technician: techDetails,
        dates: techTimesheets.map(t => t.date).sort(),
        status: existingAssignment?.status || 'confirmed',
        source: existingAssignment ? 'assignment' : 'timesheet',
        roles: {
          sound_role: existingAssignment?.sound_role,
          lights_role: existingAssignment?.lights_role,
          video_role: existingAssignment?.video_role,
        },
        original_assignment: existingAssignment
      };

      aggregatedAssignments.push(aggregated);
    });
    
    result[jobId] = aggregatedAssignments;
  });

  return result;
}
