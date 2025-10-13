import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RateExtraRow } from '@/hooks/useRateExtrasCatalog';
import { TourBaseRateRow } from '@/hooks/useTourBaseRates';
import { RATES_QUERY_KEYS } from '@/constants/ratesQueryKeys';

type Nullable<T> = T | null | undefined;

export interface RatesOverview {
  totals: {
    pendingTours: number;
    baseRates: number;
    extras: number;
    houseOverrides: number;
  };
  pendingTours: Array<{ id: string; title: string; start_date: string | null; rates_approved: boolean }>;
  extrasCatalog: RateExtraRow[];
  baseRates: TourBaseRateRow[];
  recentOverrides: Array<{ profileId: string; profileName: string; baseDayEur: number | null; updatedAt: string | null }>;
}

export interface HouseTechOverrideListItem {
  profileId: string;
  profileName: string;
  defaultCategory: string | null;
  overrideBaseDay: number | null;
  overrideUpdatedAt: string | null;
}

export interface RatesApprovalRow {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  ratesApproved: boolean;
  jobCount: number;
  assignmentCount: number;
  pendingIssues: string[];
}

const DEFAULT_CATEGORY = 'tecnico';

export async function fetchRatesOverview(): Promise<RatesOverview> {
  const [toursResult, extrasResult, baseRatesResult, overridesResult] = await Promise.all([
    supabase
      .from('tours')
      .select('id, title, start_date, rates_approved')
      .order('start_date', { ascending: true })
      .eq('rates_approved', false)
      .limit(5),
    supabase
      .from('rate_extras_2025')
      .select('*')
      .order('extra_type', { ascending: true }),
    supabase
      .from('rate_cards_tour_2025')
      .select('*')
      .order('category', { ascending: true }),
    supabase
      .from('house_tech_rates')
      .select('profile_id, base_day_eur, updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .limit(5),
  ]);

  if (toursResult.error) throw toursResult.error;
  if (extrasResult.error) throw extrasResult.error;
  if (baseRatesResult.error) throw baseRatesResult.error;
  if (overridesResult.error) throw overridesResult.error;

  const recentOverridesRaw = overridesResult.data || [];
  const overrideProfileIds = recentOverridesRaw.map((row) => row.profile_id).filter(Boolean) as string[];
  let profileNameMap: Record<string, string> = {};

  if (overrideProfileIds.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', overrideProfileIds);

    if (profilesError) throw profilesError;

    profileNameMap = Object.fromEntries(
      (profilesData || []).map((profile) => [
        profile.id,
        `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Sin nombre',
      ]),
    );
  }

  const extrasCatalog = (extrasResult.data || []) as RateExtraRow[];
  const baseRates = (baseRatesResult.data || []) as TourBaseRateRow[];

  return {
    totals: {
      pendingTours: (toursResult.data || []).length,
      baseRates: baseRates.length,
      extras: extrasCatalog.length,
      houseOverrides: overridesResult.count ?? recentOverridesRaw.length,
    },
    pendingTours: (toursResult.data || []) as Array<{
      id: string;
      title: string;
      start_date: string | null;
      rates_approved: boolean;
    }>,
    extrasCatalog,
    baseRates,
    recentOverrides: recentOverridesRaw.map((row) => ({
      profileId: row.profile_id,
      profileName: profileNameMap[row.profile_id] || 'Sin nombre',
      baseDayEur: row.base_day_eur ?? null,
      updatedAt: row.updated_at ?? null,
    })),
  };
}

export async function fetchHouseTechOverrides(): Promise<HouseTechOverrideListItem[]> {
  const { data: technicians, error: techniciansError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, default_timesheet_category, role')
    .eq('role', 'house_tech')
    .order('first_name', { ascending: true });

  if (techniciansError) throw techniciansError;

  const technicianList = technicians || [];
  const profileIds = technicianList.map((tech) => tech.id);

  let overrideMap: Record<string, { base_day_eur: Nullable<number>; updated_at: Nullable<string> }> = {};

  if (profileIds.length > 0) {
    const { data: overrides, error: overridesError } = await supabase
      .from('house_tech_rates')
      .select('profile_id, base_day_eur, updated_at')
      .in('profile_id', profileIds);

    if (overridesError) throw overridesError;

    overrideMap = Object.fromEntries(
      (overrides || []).map((override) => [
        override.profile_id,
        { base_day_eur: override.base_day_eur, updated_at: override.updated_at },
      ]),
    );
  }

  return technicianList.map((tech) => ({
    profileId: tech.id,
    profileName: `${tech.first_name ?? ''} ${tech.last_name ?? ''}`.trim() || 'Sin nombre',
    defaultCategory: tech.default_timesheet_category ?? DEFAULT_CATEGORY,
    overrideBaseDay: overrideMap[tech.id]?.base_day_eur ?? null,
    overrideUpdatedAt: overrideMap[tech.id]?.updated_at ?? null,
  }));
}

export async function fetchRatesApprovals(): Promise<RatesApprovalRow[]> {
  const { data: tours, error: toursError } = await supabase
    .from('tours')
    .select('id, title, start_date, end_date, rates_approved')
    .order('start_date', { ascending: true })
    .limit(25);

  if (toursError) throw toursError;

  const tourList = tours || [];
  const tourIds = tourList.map((tour) => tour.id).filter(Boolean) as string[];

  const jobCounts: Record<string, { jobCount: number; jobIds: string[]; assignmentCount: number }> = {};

  if (tourIds.length > 0) {
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, tour_id, job_type')
      .in('tour_id', tourIds)
      .eq('job_type', 'tourdate');

    if (jobsError) throw jobsError;

    const jobIds: string[] = [];

    (jobs || []).forEach((job) => {
      if (!job.tour_id) return;
      if (!jobCounts[job.tour_id]) {
        jobCounts[job.tour_id] = { jobCount: 0, jobIds: [], assignmentCount: 0 };
      }
      jobCounts[job.tour_id].jobCount += 1;
      jobCounts[job.tour_id].jobIds.push(job.id);
      jobIds.push(job.id);
    });

    if (jobIds.length > 0) {
      const { data: assignments, error: assignmentsError } = await supabase
        .from('job_assignments')
        .select('id, job_id')
        .in('job_id', jobIds);

      if (assignmentsError) throw assignmentsError;

      const assignmentCountByJob: Record<string, number> = {};

      (assignments || []).forEach((assignment) => {
        if (!assignment.job_id) return;
        assignmentCountByJob[assignment.job_id] = (assignmentCountByJob[assignment.job_id] || 0) + 1;
      });

      Object.values(jobCounts).forEach((info) => {
        info.assignmentCount = info.jobIds.reduce((acc, jobId) => acc + (assignmentCountByJob[jobId] || 0), 0);
      });
    }
  }

  return tourList.map((tour) => {
    const counts = jobCounts[tour.id] || { jobCount: 0, jobIds: [], assignmentCount: 0 };
    const pendingIssues: string[] = [];

    if (!tour.rates_approved) {
      pendingIssues.push('Approval required');
    }
    if (counts.jobCount === 0) {
      pendingIssues.push('No tour dates');
    }
    if (counts.assignmentCount === 0) {
      pendingIssues.push('No assignments');
    }

    return {
      id: tour.id,
      title: tour.title,
      startDate: tour.start_date ?? null,
      endDate: tour.end_date ?? null,
      ratesApproved: Boolean(tour.rates_approved),
      jobCount: counts.jobCount,
      assignmentCount: counts.assignmentCount,
      pendingIssues,
    };
  });
}

export function invalidateRatesContext(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: RATES_QUERY_KEYS.overview });
  queryClient.invalidateQueries({ queryKey: RATES_QUERY_KEYS.extrasCatalog });
  queryClient.invalidateQueries({ queryKey: RATES_QUERY_KEYS.baseRates });
  queryClient.invalidateQueries({ queryKey: RATES_QUERY_KEYS.houseTechList });
  queryClient.invalidateQueries({ queryKey: RATES_QUERY_KEYS.approvals });
}
