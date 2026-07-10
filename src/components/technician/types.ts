export interface Theme {
  bg: string;
  nav: string;
  card: string;
  textMain: string;
  textMuted: string;
  accent: string;
  input: string;
  modalOverlay: string;
  divider: string;
  danger: string;
  success: string;
  warning: string;
  cluster: string;
}

export interface TechnicianJobData {
  id: string;
  title?: string;
  description?: string;
  start_time: string;
  end_time?: string;
  timezone?: string;
  location_id?: string;
  job_type?: string;
  color?: string;
  status?: string;
  created_at?: string;
  artist_count?: number;
  has_prep_day_timesheet?: boolean;
  has_hourly_timesheet?: boolean;
  job_date_types?: Array<{ date?: string | null; type?: string | null }> | null;
  preventive_resource_technician_id?: string | null;
  location?: { name: string } | null;
  job_documents?: Array<{
    id: string;
    file_name: string;
    file_path: string;
    visible_to_tech?: boolean;
    uploaded_at?: string;
    read_only?: boolean;
    template_type?: string | null;
  }>;
}

export interface TechnicianAssignment {
  id: string;
  job_id: string;
  technician_id: string;
  department?: string;
  role?: string;
  category?: string;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  start_time?: string;
  jobs?: TechnicianJobData | null;
}

export type CreateTechnicianAssignment = Omit<TechnicianAssignment, 'id'> & { id?: never };

export interface JobCardProps {
  job: any;
  theme: Theme;
  isDark: boolean;
  onAction: (action: string, job?: any) => void;
  isCrewChief: boolean;
  techName?: string;
  onOpenObliqueStrategy?: () => void;
}
