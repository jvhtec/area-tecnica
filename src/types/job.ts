export interface JobDocument {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  visible_to_tech?: boolean;
  read_only?: boolean;
  template_type?: string | null;
}

export type JobType = "single" | "multi_day" | "tour" | "tourdate" | "festival" | "dryhire";

export interface Location {
  id: string;
  name: string;
  formatted_address?: string;
  address?: string;
  latitude?: number | string;
  longitude?: number | string;
}

export interface TechnicianProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface StaffAssignment {
  sound_role?: string;
  lights_role?: string;
  video_role?: string;
  technician?: TechnicianProfile;
}

export interface Job {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location_id?: string;
  tour_date_id?: string;
  color?: string;
  status?: string;
  created_by?: string;
  created_at: string;
  job_type: JobType;
  flex_folders_created?: boolean;
}

export interface JobWithLocationAndDocs extends Job {
  job_documents?: JobDocument[];
  locations?: Location;
  location?: Location;
}