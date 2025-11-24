export interface Assignment {
  id: string;
  job_id: string;
  technician_id: string;
  assigned_by: string | null;
  assigned_at: string;
  // DEPRECATED: Use timesheets to determine which days a technician works
  assignment_date?: string | null;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  // DEPRECATED: Use timesheets to determine which days a technician works
  single_day?: boolean | null;
  profiles: {
    first_name: string;
    nickname?: string | null;
    last_name: string;
    email: string;
    department: string;
  };
}
