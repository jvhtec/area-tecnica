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
  pendingTours: Array<{ id: string; name: string; start_date: string | null; rates_approved: boolean }>;
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
  name: string;
  startDate: string | null;
  endDate: string | null;
  ratesApproved: boolean;
  jobCount: number;
  assignmentCount: number;
  pendingIssues: string[];
  entityType: 'tour' | 'job';
  jobType?: string | null;
  status?: string | null;
}

const DEFAULT_CATEGORY = 'tecnico';

export async function fetchRatesOverview(): Promise<RatesOverview> {
  const [toursResult, extrasResult, baseRatesResult, overridesResult] = await Promise.all([
    supabase
      .from('tours')
      .select('id, name, start_date, rates_approved')
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
      name: string;
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
  // 1) Fetch tours excluding cancelled
  const { data: tours, error: toursError } = await supabase
    .from('tours')
    .select('id, name, start_date, end_date, rates_approved, status')
    .neq('status', 'cancelled')
    .order('start_date', { ascending: true });

  if (toursError) throw toursError;

  const tourList = tours || [];
  const tourIds = tourList.map((tour) => tour.id).filter(Boolean) as string[];

  // Build counts for tour-linked jobs (excluding dry hire) and their assignments
  const tourCounts: Record<string, { jobCount: number; jobIds: string[]; assignmentCount: number }> = {};
  const jobReviewIds = new Set<string>();

  if (tourIds.length > 0) {
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, tour_id, job_type')
      .in('tour_id', tourIds);

    if (jobsError) throw jobsError;

    const tourJobIds: string[] = [];

    (jobs || [])
      .filter((job) => {
        const type = (job.job_type ?? '').toLowerCase();
        return type !== 'dryhire';
      })
      .forEach((job) => {
      if (!job.tour_id) return;
      if (!tourCounts[job.tour_id]) {
        tourCounts[job.tour_id] = { jobCount: 0, jobIds: [], assignmentCount: 0 };
      }
      tourCounts[job.tour_id].jobCount += 1;
      tourCounts[job.tour_id].jobIds.push(job.id);
      tourJobIds.push(job.id);
      jobReviewIds.add(job.id);
    });

    if (tourJobIds.length > 0) {
      const { data: assignments, error: assignmentsError } = await supabase
        .from('job_assignments')
        .select('job_id')
        .in('job_id', tourJobIds);

      if (assignmentsError) throw assignmentsError;

      const assignmentCountByJob: Record<string, number> = {};

      (assignments || []).forEach((assignment) => {
        if (!assignment.job_id) return;
        assignmentCountByJob[assignment.job_id] = (assignmentCountByJob[assignment.job_id] || 0) + 1;
      });

      Object.values(tourCounts).forEach((info) => {
        info.assignmentCount = info.jobIds.reduce((acc, jobId) => acc + (assignmentCountByJob[jobId] || 0), 0);
      });
    }
  }

  // 2) Fetch standalone jobs (exclude dry hire and tour dates; exclude cancelled)
  const { data: jobsList, error: jobsError2 } = await supabase
    .from('jobs')
    .select('id, title, start_time, end_time, job_type, status, rates_approved, tour_id')
    .neq('job_type', 'tourdate')
    .neq('job_type', 'dryhire')
    .eq('status', 'Confirmado')
    .order('start_time', { ascending: true });

  if (jobsError2) throw jobsError2;

  const standaloneJobs = (jobsList || []).filter(
    (j) => !j.tour_id && (j.job_type ?? '').toLowerCase() !== 'tour'
  );
  const jobIds = standaloneJobs.map((j) => j.id);
  jobIds.forEach((id) => jobReviewIds.add(id));

  const assignmentCountByJob: Record<string, number> = {};
  const timesheetInfoByJob: Record<string, { total: number; approved: number; rejected: number }> = {};
  const extrasInfoByJob: Record<string, { pending: number; rejected: number }> = {};
  if (jobIds.length > 0) {
    const { data: assignments2, error: assignmentsError2 } = await supabase
      .from('job_assignments')
      .select('job_id')
      .in('job_id', jobIds);
    if (assignmentsError2) throw assignmentsError2;
    (assignments2 || []).forEach((a) => {
      if (!a.job_id) return;
      assignmentCountByJob[a.job_id] = (assignmentCountByJob[a.job_id] || 0) + 1;
    });

  }

  if (jobReviewIds.size > 0) {
    const reviewList = Array.from(jobReviewIds);
    const [{ data: timesheets, error: timesheetsError }, { data: extras, error: extrasError }] = await Promise.all([
      supabase
        .from('timesheets')
        .select('job_id, status')
        .in('job_id', reviewList),
      supabase
        .from('job_rate_extras')
        .select('job_id, status')
        .in('job_id', reviewList),
    ]);
    if (timesheetsError) throw timesheetsError;
    if (extrasError) throw extrasError;

    (timesheets || []).forEach((t: any) => {
      if (!t.job_id) return;
      const status = String(t.status ?? '').toLowerCase();
      const bucket = (timesheetInfoByJob[t.job_id] ||= { total: 0, approved: 0, rejected: 0 });
      bucket.total += 1;
      if (status === 'approved') bucket.approved += 1;
      if (status === 'rejected') bucket.rejected += 1;
    });

    (extras || []).forEach((row: any) => {
      if (!row.job_id) return;
      const status = String(row.status ?? '').toLowerCase();
      const bucket = (extrasInfoByJob[row.job_id] ||= { pending: 0, rejected: 0 });
      if (status === 'pending') bucket.pending += 1;
      if (status === 'rejected') bucket.rejected += 1;
    });
  }

  const tourRows: RatesApprovalRow[] = tourList.map((tour) => {
    const counts = tourCounts[tour.id] || { jobCount: 0, jobIds: [], assignmentCount: 0 };
    const pendingIssues: string[] = [];

    if (!tour.rates_approved) {
      pendingIssues.push('Approval required');
    }
    if (counts.jobCount === 0) {
      pendingIssues.push('No tour jobs');
    }
    if (counts.assignmentCount === 0) {
      pendingIssues.push('No assignments');
    }

    if (counts.jobIds.length > 0) {
      const jobSummaries = counts.jobIds.map((jobId) => timesheetInfoByJob[jobId]);
      const allMissingTimesheets = jobSummaries.every((summary) => !summary || summary.total === 0);
      const anyRejectedTimesheets = jobSummaries.some((summary) => (summary?.rejected ?? 0) > 0);
      const anyPendingTimesheets = jobSummaries.some((summary) => {
        if (!summary) return true;
        return summary.total > 0 && summary.approved < summary.total;
      });

      if (allMissingTimesheets) {
        pendingIssues.push('No timesheets');
      } else if (anyRejectedTimesheets) {
        pendingIssues.push('Timesheets rejected');
      } else if (anyPendingTimesheets) {
        pendingIssues.push('Timesheets pending');
      }

      const extrasSummaries = counts.jobIds.map((jobId) => extrasInfoByJob[jobId]);
      const extrasPending = extrasSummaries.some((summary) => (summary?.pending ?? 0) > 0);
      const extrasRejected = extrasSummaries.some((summary) => (summary?.rejected ?? 0) > 0);
      if (extrasPending) pendingIssues.push('Extras pending');
      if (extrasRejected) pendingIssues.push('Extras rejected');
    }

    return {
      id: tour.id,
      name: tour.name,
      startDate: tour.start_date ?? null,
      endDate: tour.end_date ?? null,
      ratesApproved: Boolean(tour.rates_approved),
      jobCount: counts.jobCount,
      assignmentCount: counts.assignmentCount,
      pendingIssues,
      entityType: 'tour',
      jobType: 'tour',
      status: tour.status ?? null,
    };
  });

  const jobRows: RatesApprovalRow[] = standaloneJobs.map((job) => {
    const pendingIssues: string[] = [];
    const assignmentCount = assignmentCountByJob[job.id] || 0;
    if (!job.rates_approved) pendingIssues.push('Approval required');
    if (assignmentCount === 0) pendingIssues.push('No assignments');
    const tInfo = timesheetInfoByJob[job.id];
    if (!tInfo || tInfo.total === 0) {
      pendingIssues.push('No timesheets');
    } else if ((tInfo.rejected ?? 0) > 0) {
      pendingIssues.push('Timesheets rejected');
    } else if (tInfo.approved < tInfo.total) {
      pendingIssues.push('Timesheets pending');
    }

    const extraInfo = extrasInfoByJob[job.id];
    if ((extraInfo?.pending ?? 0) > 0) {
      pendingIssues.push('Extras pending');
    }
    if ((extraInfo?.rejected ?? 0) > 0) {
      pendingIssues.push('Extras rejected');
    }

    return {
      id: job.id,
      name: job.title,
      startDate: job.start_time ?? null,
      endDate: job.end_time ?? null,
      ratesApproved: Boolean(job.rates_approved),
      jobCount: 1,
      assignmentCount,
      pendingIssues,
      entityType: 'job',
      jobType: job.job_type ?? null,
      status: job.status ?? null,
    };
  });

  // 3) Merge and sort by start date
  const allRows = [...tourRows, ...jobRows];
  allRows.sort((a, b) => {
    const aDate = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bDate = b.startDate ? new Date(b.startDate).getTime() : 0;
    return aDate - bDate;
  });

  return allRows;
}

export function invalidateRatesContext(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: RATES_QUERY_KEYS.overview });
  queryClient.invalidateQueries({ queryKey: RATES_QUERY_KEYS.extrasCatalog });
  queryClient.invalidateQueries({ queryKey: RATES_QUERY_KEYS.baseRates });
  queryClient.invalidateQueries({ queryKey: RATES_QUERY_KEYS.houseTechList });
  queryClient.invalidateQueries({ queryKey: RATES_QUERY_KEYS.approvals });
}
