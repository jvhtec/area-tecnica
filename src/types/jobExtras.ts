export type JobExtraType = 'travel_half' | 'travel_full' | 'day_off';

export interface JobExtra {
  job_id: string;
  technician_id: string;
  extra_type: JobExtraType;
  quantity: number;
  status?: 'pending' | 'approved' | 'rejected';
  amount_override_eur?: number;
  updated_by?: string;
  updated_at: string;
}

export interface JobExtraItem {
  extra_type: JobExtraType;
  quantity: number;
  unit_eur: number;
  amount_eur: number;
  is_house_tech_rate?: boolean;
}

export interface JobExtrasBreakdown {
  items?: JobExtraItem[];
  total_eur?: number;
}

export interface JobExpenseBreakdownItem {
  category_slug: string;
  status_counts?: Record<string, number>;
  amount_totals?: Record<string, number>;
  approved_total_eur?: number;
  submitted_total_eur?: number;
  draft_total_eur?: number;
  rejected_total_eur?: number;
  last_receipt_at?: string | null;
}

export interface JobPayoutTotals {
  job_id: string;
  technician_id: string;
  timesheets_total_eur: number;
  extras_total_eur: number;
  expenses_total_eur: number;
  total_eur: number;
  extras_breakdown: JobExtrasBreakdown;
  expenses_breakdown: JobExpenseBreakdownItem[];
  vehicle_disclaimer: boolean;
  vehicle_disclaimer_text?: string;
  payout_approved?: boolean;

  // Manual payout override metadata (enriched client-side / for exports)
  has_override?: boolean;
  override_amount_eur?: number;
  calculated_total_eur?: number;
  override_set_at?: string;
  override_actor_name?: string;
  override_actor_email?: string;
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