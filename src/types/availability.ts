
export type AvailabilityStatus = 'available' | 'unavailable' | 'tentative';

/**
 * Reason a technician is marked as not available on a given day, as set from the
 * personal calendar / tech detail views. Shared by `HouseTechBadge`,
 * `TechDetailModal`, `TechContextMenu`, `PersonalCalendar`, `MobilePersonalCalendar`
 * and `useTechnicianAvailability` — keep one definition so the handler signatures
 * stay assignable to each other under `strictFunctionTypes`.
 */
export type TechUnavailabilityStatus =
  | 'vacation'
  | 'travel'
  | 'sick'
  | 'day_off'
  | 'warehouse'
  | 'unavailable';

export interface AvailabilitySchedule {
  id: string;
  user_id: string;
  department: string;
  date: string;
  status: AvailabilityStatus;
  // Nullable to match the `availability_schedules` columns.
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GlobalAvailabilityPreset {
  id: string;
  name: string;
  day_of_week: number;
  department: string;
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
