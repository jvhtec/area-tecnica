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
  category: string;
  base_day_eur: number;
  week_count: number;
  multiplier: number;
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
    [key: string]: any;
  };
}