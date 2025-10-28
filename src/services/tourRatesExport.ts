import { supabase } from '@/integrations/supabase/client';
import type { TourJobRateQuote } from '@/types/tourRates';

export interface TourRatesExportJob {
  id: string;
  title: string;
  start_time: string;
  end_time?: string | null;
}

export interface TourRatesExportProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  default_timesheet_category?: string | null;
  role?: string | null;
}

export interface TourJobQuotesWithLPO {
  job: TourRatesExportJob;
  quotes: TourJobRateQuote[];
  lpoMap: Map<string, string | null>;
}

export interface TourRatesExportPayload {
  jobsWithQuotes: TourJobQuotesWithLPO[];
  profiles: TourRatesExportProfile[];
}

const mapRpcResultToQuote = (
  jobId: string,
  tourId: string,
  techId: string,
  raw: Record<string, any>
): TourJobRateQuote => ({
  job_id: raw.job_id ?? jobId,
  technician_id: raw.technician_id ?? techId,
  start_time: raw.start_time,
  end_time: raw.end_time,
  job_type: raw.job_type ?? 'tourdate',
  tour_id: raw.tour_id ?? tourId,
  title: raw.title ?? '',
  is_house_tech: !!raw.is_house_tech,
  is_tour_team_member: !!raw.is_tour_team_member,
  category: raw.category ?? '',
  base_day_eur: Number(raw.base_day_eur ?? 0),
  week_count: Number(raw.week_count ?? 1),
  multiplier: Number(raw.multiplier ?? 1),
  iso_year: raw.iso_year ?? null,
  iso_week: raw.iso_week ?? null,
  total_eur: Number(raw.total_eur ?? 0),
  extras: raw.extras,
  extras_total_eur: raw.extras_total_eur != null ? Number(raw.extras_total_eur) : undefined,
  total_with_extras_eur: raw.total_with_extras_eur != null ? Number(raw.total_with_extras_eur) : undefined,
  vehicle_disclaimer: raw.vehicle_disclaimer,
  vehicle_disclaimer_text: raw.vehicle_disclaimer_text,
  breakdown: raw.breakdown ?? {},
});

export async function buildTourRatesExportPayload(
  tourId: string,
  jobs: TourRatesExportJob[]
): Promise<TourRatesExportPayload> {
  if (!tourId || jobs.length === 0) {
    return { jobsWithQuotes: [], profiles: [] };
  }

  const jobIds = jobs.map((job) => job.id).filter(Boolean);
  if (jobIds.length === 0) {
    return { jobsWithQuotes: [], profiles: [] };
  }

  const [assignmentsResult, lpoResult] = await Promise.all([
    supabase
      .from('job_assignments')
      .select('job_id, technician_id')
      .in('job_id', jobIds),
    supabase
      .from('flex_work_orders')
      .select('job_id, technician_id, lpo_number')
      .in('job_id', jobIds),
  ]);

  if (assignmentsResult.error) throw assignmentsResult.error;
  if (lpoResult.error) throw lpoResult.error;

  const assignmentsByJob = new Map<string, Set<string>>();
  (assignmentsResult.data || []).forEach((row) => {
    if (!row.job_id || !row.technician_id) return;
    if (!assignmentsByJob.has(row.job_id)) {
      assignmentsByJob.set(row.job_id, new Set());
    }
    assignmentsByJob.get(row.job_id)!.add(row.technician_id);
  });

  const lpoByJob = new Map<string, Map<string, string | null>>();
  (lpoResult.data || []).forEach((row) => {
    if (!row.job_id || !row.technician_id) return;
    if (!lpoByJob.has(row.job_id)) {
      lpoByJob.set(row.job_id, new Map());
    }
    lpoByJob.get(row.job_id)!.set(row.technician_id, row.lpo_number);
  });

  const jobsWithQuotes: TourJobQuotesWithLPO[] = [];

  for (const job of jobs) {
    const techIds = Array.from(assignmentsByJob.get(job.id) ?? []);
    if (techIds.length === 0) continue;

    const quotes = await Promise.all(
      techIds.map(async (techId) => {
        const { data, error } = await supabase.rpc('compute_tour_job_rate_quote_2025', {
          _job_id: job.id,
          _tech_id: techId,
        });

        if (error) {
          return {
            job_id: job.id,
            technician_id: techId,
            start_time: job.start_time,
            end_time: job.end_time ?? job.start_time,
            job_type: 'tourdate',
            tour_id: tourId,
            title: job.title,
            is_house_tech: false,
            is_tour_team_member: false,
            category: '',
            base_day_eur: 0,
            week_count: 1,
            multiplier: 1,
            iso_year: null,
            iso_week: null,
            total_eur: 0,
            extras: undefined,
            extras_total_eur: undefined,
            total_with_extras_eur: undefined,
            vehicle_disclaimer: undefined,
            vehicle_disclaimer_text: undefined,
            breakdown: { error: error.message },
          } as TourJobRateQuote;
        }

        const raw = (data || {}) as Record<string, any>;
        return mapRpcResultToQuote(job.id, tourId, techId, raw);
      })
    );

    const filteredQuotes = (quotes.filter(Boolean) as TourJobRateQuote[]).filter(
      (quote) => quote.technician_id
    );

    if (filteredQuotes.length === 0) continue;

    const lpoMap = lpoByJob.get(job.id) ?? new Map<string, string | null>();

    jobsWithQuotes.push({
      job,
      quotes: filteredQuotes,
      lpoMap,
    });
  }

  const uniqueTechIds = Array.from(
    new Set(
      jobsWithQuotes.flatMap((job) => job.quotes.map((quote) => quote.technician_id).filter(Boolean))
    )
  );

  if (uniqueTechIds.length === 0) {
    return { jobsWithQuotes, profiles: [] };
  }

  const profilesResult = await supabase
    .from('profiles')
    .select('id, first_name, last_name, default_timesheet_category, role')
    .in('id', uniqueTechIds);

  if (profilesResult.error) throw profilesResult.error;

  return {
    jobsWithQuotes,
    profiles: profilesResult.data || [],
  };
}
