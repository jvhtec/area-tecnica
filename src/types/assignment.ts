export interface Assignment {
  id: string;
  job_id: string;
  technician_id: string;
  assigned_by: string | null;
  assigned_at: string;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  profiles: {
    first_name: string;
    last_name: string;
    email: string;
    department: string;
  };
}