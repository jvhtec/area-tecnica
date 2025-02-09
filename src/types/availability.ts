
export type AvailabilityStatus = 'available' | 'unavailable' | 'tentative';

export interface AvailabilitySchedule {
  id: string;
  user_id: string;
  department: string;
  date: string;
  status: AvailabilityStatus;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AvailabilityPreference {
  id: string;
  user_id: string;
  department: string;
  day_of_week: number;
  status: AvailabilityStatus;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AvailabilityException {
  id: string;
  user_id: string;
  department: string;
  start_date: string;
  end_date: string;
  status: AvailabilityStatus;
  reason?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AvailabilityConflict {
  id: string;
  user_id: string;
  job_id: string;
  department: string;
  conflict_date: string;
  status: string;
  resolved_at?: string;
  resolved_by?: string;
  created_at?: string;
  updated_at?: string;
}
