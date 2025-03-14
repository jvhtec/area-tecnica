
export interface Assignment {
  id: string;
  job_id: string;
  technician_id: string;
  assigned_by: string | null;
  assigned_at: string;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  role?: string;
  profiles?: {
    id?: string;
    first_name: string;
    last_name: string;
    email: string;
    department: string;
    role?: string;
  } | null;
  shift_id?: string;
}
