
export interface FestivalShift {
  id: string;
  /** Nullable to match the `festival_shifts.job_id` column. */
  job_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  name: string; // e.g. "Morning Shift", "Sound Check", etc.
  // The optional columns are nullable in the database.
  notes?: string | null;
  stage?: number | null;
  department?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ShiftAssignment {
  id: string;
  shift_id: string;
  technician_id?: string | null;
  external_technician_name?: string | null;
  role: string;
  created_at?: string | null;
  /** Display fields from `get_profile_directory` (no contact details). */
  profiles?: {
    id: string;
    first_name: string | null;
    nickname?: string | null;
    last_name: string | null;
    department: string | null;
    role: string | null;
  } | null;
}

export interface ShiftWithAssignments extends FestivalShift {
  assignments: ShiftAssignment[];
}

export interface Technician {
  id: string;
  first_name: string;
  nickname?: string | null;
  last_name: string;
  email: string;
  department: string;
  role: string; // Their general role (technician, house_tech)
}
