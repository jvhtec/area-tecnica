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
  iso_year: number;
  iso_week: number;
  total_eur: number;
  breakdown: {
    error?: string;
    [key: string]: any;
  };
}