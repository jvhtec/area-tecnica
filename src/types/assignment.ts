export interface AssignmentProfile {
  first_name: string;
  nickname?: string | null;
  last_name: string;
  email?: string | null;
  department?: string | null;
}

export interface Assignment {
  id?: string;
  job_id: string;
  technician_id: string;
  assigned_by?: string | null;
  assigned_at?: string | null;
  assignment_date?: string | null;  // Standardized: specific date for single-day assignments, NULL for whole-job
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  single_day?: boolean | null;
  assignment_source?: string | null;
  external_technician_name?: string | null;
  profiles?: AssignmentProfile | null;
  timesheet_dates?: string[];
  timesheet_ranges?: Array<{ start: string; end: string }>;
}
