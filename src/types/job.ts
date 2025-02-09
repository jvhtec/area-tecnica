export interface JobDocument {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
}

export type JobType = "single" | "tour" | "tourdate" | "festival" | "dryhire";

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