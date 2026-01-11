import { JobExtrasBreakdown } from '@/types/jobExtras';

export interface TourJobRateQuote {
  job_id: string;
  technician_id: string;
  start_time: string;
  end_time: string;
  job_type: string;
  tour_id: string;
  title: string;
  is_house_tech: boolean;
  is_tour_team_member?: boolean;
  use_tour_multipliers?: boolean; // Override flag to force tour multipliers even if not tour-wide assigned
  category: string;
  base_day_eur: number;
  week_count: number;
  multiplier: number;
  per_job_multiplier?: number;
  iso_year: number | null;
  iso_week: number | null;
  total_eur: number;
  // Extras fields (optional for backward compatibility)
  extras?: JobExtrasBreakdown;
  extras_total_eur?: number;
  total_with_extras_eur?: number;
  vehicle_disclaimer?: boolean;
  vehicle_disclaimer_text?: string;
  breakdown: {
    error?: string;
    autonomo_discount_eur?: number;
    [key: string]: any;
  };
  // Payout override fields (when manual override is set)
  autonomo_discount_eur?: number;
  has_override?: boolean; // True if override_amount_eur is set
  override_amount_eur?: number; // Manual override amount (if set)
  calculated_total_eur?: number; // Original calculated amount (before override)
}
