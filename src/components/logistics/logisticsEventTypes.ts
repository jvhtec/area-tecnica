import type { Database } from "@/integrations/supabase/types";

type LogisticsEventRow = Database["public"]["Tables"]["logistics_events"]["Row"];

export type LogisticsCalendarEvent = LogisticsEventRow & {
  departments: Array<{ department: string }>;
  job?: { id?: string; title: string } | null;
};

export type BroadcastLogisticsEvent = Pick<
  LogisticsEventRow,
  | "id"
  | "job_id"
  | "event_type"
  | "event_date"
  | "event_time"
  | "title"
  | "transport_type"
  | "loading_bay"
  | "license_plate"
>;
