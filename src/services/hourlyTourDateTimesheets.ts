import { supabase } from '@/integrations/supabase/client';

export interface HourlyTourDateRateMode {
  job_id: string;
  technician_id: string;
  date: string;
}

interface FetchHourlyTourDateRateModesOptions {
  jobIds?: string[];
  technicianId?: string;
}

interface HourlyTourDateRpcClient {
  rpc: (
    functionName: 'get_hourly_rate_mode_dates_for_timesheets',
    args: { _job_ids: string[] | null },
  ) => PromiseLike<{ data: HourlyTourDateRateMode[] | null; error: unknown }>;
}

export const hourlyTourDateTimesheetKey = (technicianId: string, date: string): string =>
  `${technicianId}:${date}`;

export function filterEligibleTourDateTimesheets<
  T extends { technician_id: string; date: string },
>(
  timesheets: T[],
  prepDayDates: ReadonlySet<string>,
  hourlyRateModes: HourlyTourDateRateMode[],
): T[] {
  const hourlyTimesheetKeys = new Set(
    hourlyRateModes.map((row) => hourlyTourDateTimesheetKey(row.technician_id, row.date)),
  );

  return timesheets.filter((row) => (
    prepDayDates.has(row.date) ||
    hourlyTimesheetKeys.has(hourlyTourDateTimesheetKey(row.technician_id, row.date))
  ));
}

export async function fetchHourlyTourDateRateModes(
  options: FetchHourlyTourDateRateModesOptions = {},
): Promise<HourlyTourDateRateMode[]> {
  const { jobIds, technicianId } = options;

  if (jobIds && jobIds.length === 0) return [];

  // The generated Supabase types lag behind this RPC's migration.
  const rpcClient = supabase as unknown as HourlyTourDateRpcClient;
  const { data, error } = await rpcClient.rpc('get_hourly_rate_mode_dates_for_timesheets', {
    _job_ids: jobIds ?? null,
  });
  if (error) throw error;

  const rows = data || [];
  return technicianId
    ? rows.filter((row) => row.technician_id === technicianId)
    : rows;
}
