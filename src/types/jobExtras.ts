export type JobExtraType = 'travel_half' | 'travel_full' | 'day_off';

export interface JobExtra {
  job_id: string;
  technician_id: string;
  extra_type: JobExtraType;
  quantity: number;
  pending_quantity?: number | null;
  status?: 'pending' | 'approved' | 'rejected';
  submitted_at?: string | null;
  submitted_by?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejection_reason?: string | null;
  amount_override_eur?: number;
  updated_by?: string;
  updated_at: string;
}

export interface JobExtraItem {
  extra_type: JobExtraType;
  quantity: number;
  unit_eur: number;
  amount_eur: number;
}

export interface JobExtrasBreakdown {
  items: JobExtraItem[];
  total_eur: number;
}

export interface JobPayoutTotals {
  job_id: string;
  technician_id: string;
  timesheets_total_eur: number;
  extras_total_eur: number;
  total_eur: number;
  extras_breakdown: JobExtrasBreakdown;
  vehicle_disclaimer: boolean;
  vehicle_disclaimer_text?: string;
}

export const EXTRA_TYPE_LABELS: Record<JobExtraType, string> = {
  travel_half: 'Half Travel Day',
  travel_full: 'Full Travel Day',
  day_off: 'Day Off'
};

export const EXTRA_TYPE_LIMITS: Record<JobExtraType, number> = {
  travel_half: 2,
  travel_full: 1,
  day_off: 1
};