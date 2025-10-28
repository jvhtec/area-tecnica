export interface Assignment {
  id: string;
  job_id: string;
  technician_id: string;
  assigned_by: string | null;
  assigned_at: string;
  assignment_date: string | null;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  single_day: boolean;
  profiles: {
    first_name: string;
    nickname?: string | null;
    last_name: string;
    email: string;
    department: string;
  };
}