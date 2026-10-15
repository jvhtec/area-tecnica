export type ConsumosJob = {
  id: string;
  title?: string;
  start_time?: string;
  end_time?: string;
  date?: string;
  tour_date_id?: string | null;
  tour_date?: {
    date?: string;
    tour?: { name?: string } | null;
    location?: { name?: string } | null;
  } | null;
  location?: { name?: string } | null;
};
