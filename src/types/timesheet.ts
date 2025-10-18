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
  ends_next_day?: boolean;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  signature_data?: string;
  signed_at?: string;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  rejected_at?: string;
  rejected_by?: string;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  // New 2025 rate calculator fields
  category?: 'tecnico' | 'especialista' | 'responsable';
  amount_eur?: number;
  amount_breakdown?: {
    category: string;
    worked_minutes: number;
    worked_hours_rounded: number;
    base_day_hours: number;
    mid_tier_hours: number;
    base_amount_eur: number;
    overtime_hours: number;
    overtime_hour_eur: number;
    overtime_amount_eur: number;
    total_eur: number;
    notes: string[];
  };
  // Visible-only fields (DB visibility rules applied via RPC)
  amount_eur_visible?: number | null;
  amount_breakdown_visible?: {
    category: string;
    worked_minutes: number;
    worked_hours_rounded: number;
    base_day_hours: number;
    mid_tier_hours: number;
    base_amount_eur: number;
    overtime_hours: number;
    overtime_hour_eur: number;
    overtime_amount_eur: number;
    total_eur: number;
    notes: string[];
  } | null;
  approved_by_manager?: boolean;
  technician?: {
    first_name: string;
    nickname?: string | null;
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
  ends_next_day?: boolean;
  category?: 'tecnico' | 'especialista' | 'responsable';
}

export interface RateCard2025 {
  id: string;
  category: 'tecnico' | 'especialista' | 'responsable';
  base_day_eur: number;
  plus_10_12_eur: number;
  overtime_hour_eur: number;
  base_day_hours: number;
  mid_tier_hours: number;
}
