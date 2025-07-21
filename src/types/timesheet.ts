export interface Timesheet {
  id: string;
  job_id: string;
  technician_id: string;
  date: string;
  start_time?: string;
  end_time?: string;
  break_minutes: number;
  overtime_hours: number;
  notes?: string;
  status: 'draft' | 'submitted' | 'approved';
  signature_data?: string;
  signed_at?: string;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
    department: string;
  };
}

export interface TimesheetFormData {
  date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  overtime_hours: number;
  notes: string;
}