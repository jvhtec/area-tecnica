
export interface FestivalShift {
  id: string;
  job_id: string;
  date: string;
  start_time: string;
  end_time: string;
  name: string; // e.g. "Morning Shift", "Sound Check", etc.
  notes?: string;
  stage?: number;
  department?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ShiftAssignment {
  id: string;
  shift_id: string;
  technician_id?: string;
  external_technician_name?: string;
  role: string;
  created_at?: string;
  profiles?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    department: string;
    role: string;
  } | null;
}

export interface ShiftWithAssignments extends FestivalShift {
  assignments: ShiftAssignment[];
}

export interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  role: string; // Their general role (technician, house_tech)
}
