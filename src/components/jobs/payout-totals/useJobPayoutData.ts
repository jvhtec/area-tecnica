import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { dataLayerClient } from '@/services/dataLayerClient';
import { useJobPayoutTotals } from '@/hooks/useJobPayoutTotals';
import { useManagerJobQuotes } from '@/hooks/useManagerJobQuotes';
import { useJobTechnicianPayoutOverrides } from '@/hooks/useJobPayoutOverride';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useJobRehearsalDates, useToggleDateRehearsalRate, useToggleAllDatesRehearsalRate } from '@/hooks/useToggleJobRehearsalRate';
import { useJobTechnicianRateModeDates, useSetTechnicianDateRateMode, type TechnicianDateRateMode } from '@/hooks/useTechnicianRateModeDates';
import type { TechnicianProfileWithEmail } from '@/lib/job-payout-email';
import { isJobPastClosureWindow } from '@/utils/jobClosureUtils';
import { canManagePayouts, isAdminRole, isAdministrativeDepartment } from '@/utils/permissions';
import type { Database } from '@/integrations/supabase/types';
import type { JobPayoutTotals, JobExpenseBreakdownItem } from '@/types/jobExtras';
import type { TourJobRateQuote } from '@/types/tourRates';
import { FLEX_UI_BASE_URL } from '@/utils/flexUrlResolver';
import type { JobMetadata, JobPayoutData } from './types';
import { NON_AUTONOMO_DEDUCTION_EUR } from './types';

import { queryKeys } from "@/lib/react-query";
const FIN_DOC_VIEW_ID = '8238f39c-f42e-11e0-a8de-00e08175e43e';
const MADRID_TIMEZONE = 'Europe/Madrid';

type TimesheetRow = Pick<
  Database['public']['Tables']['timesheets']['Row'],
  'technician_id' | 'amount_eur' | 'amount_breakdown' | 'approved_by_manager'
>;

type PayoutDateTimesheetRow = {
  technician_id: string | null;
  date: string | null;
};

type PayoutDateAssignmentRow = {
  technician_id: string | null;
  single_day: boolean | null;
  assignment_date: string | null;
};

type PayoutDateTypeRow = {
  date: string | null;
  type: string | null;
};

type PayoutTourDateRow = {
  start_date: string | null;
  end_date: string | null;
  date: string | null;
};

function toMadridDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatInTimeZone(parsed, MADRID_TIMEZONE, 'yyyy-MM-dd');
}

function compareDateKeys(left: string, right: string): number {
  return left.localeCompare(right);
}

function enumerateDateRange(start: string | null, end: string | null): string[] {
  if (!start) return [];
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = (end ?? start).split('-').map(Number);
  const startDate = Date.UTC(startYear, startMonth - 1, startDay);
  const endDate = Date.UTC(endYear, endMonth - 1, endDay);
  const safeEndDate = endDate < startDate ? startDate : endDate;
  const dates: string[] = [];

  for (let cursor = startDate; cursor <= safeEndDate; cursor += 86_400_000) {
    dates.push(new Date(cursor).toISOString().slice(0, 10));
  }

  return dates;
}

function isPrepDayBreakdown(amountBreakdown: TimesheetRow['amount_breakdown']): boolean {
  if (!amountBreakdown || typeof amountBreakdown !== 'object' || Array.isArray(amountBreakdown)) {
    return false;
  }

  return Boolean((amountBreakdown as Record<string, unknown>).is_prep_day);
}

export function useJobPayoutData(jobId: string, technicianId?: string): JobPayoutData {
  /* ── Auth ── */
  const { userRole, userDepartment } = useOptimizedAuth();
  const isManager = canManagePayouts(userRole, userDepartment);
  const isAdmin = isAdminRole(userRole);
  const isAdminOrAdministrative = isAdmin || isAdministrativeDepartment(userDepartment);

  /* ── Job metadata ── */
  const {
    data: jobMeta,
    isLoading: jobMetaLoading,
    error: jobMetaError,
  } = useQuery({
    queryKey: queryKeys.scope('job-payout-metadata', jobId),
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('jobs')
        .select('id, title, start_time, end_time, timezone, tour_id, tour_date_id, rates_approved, job_type, invoicing_company')
        .eq('id', jobId)
        .maybeSingle();
      if (error) throw error;
      return data as JobMetadata;
    },
    staleTime: 60_000,
  });

  const jobType = jobMeta?.job_type ?? null;
  const isTourDate = jobType === 'tourdate';
  // Admins can approve/edit payouts even after the 7-day closure window.
  const isClosureLocked =
    !isAdmin
    && (
      jobMetaLoading
      || Boolean(jobMetaError)
      || Boolean(jobMeta && isJobPastClosureWindow(jobMeta.end_time, jobMeta.timezone ?? 'Europe/Madrid'))
    );
  const shouldLoadStandardTotals = !!jobId && !isTourDate && !jobMetaLoading;
  const shouldLoadTourQuotes = !!jobId && isTourDate;

  /* ── Standard payout totals ── */
  const {
    data: standardPayoutTotals = [],
    isLoading: standardLoading,
    error: standardError,
  } = useJobPayoutTotals(jobId, technicianId, { enabled: shouldLoadStandardTotals });

  /* ── Tour quotes ── */
  const {
    data: rawTourQuotes = [],
    isLoading: tourQuotesLoading,
    error: tourQuotesError,
  } = useManagerJobQuotes(
    shouldLoadTourQuotes ? jobId : undefined,
    jobType ?? undefined,
    jobMeta?.tour_id ?? undefined
  );

  /* ── Tour timesheet approvals ── */
  const { data: tourApprovals = new Map<string, boolean>() } = useQuery({
    queryKey: queryKeys.scope('job-tech-payout', jobId, 'tour-timesheet-data'),
    enabled: !!jobId && isTourDate,
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('timesheets')
        .select('technician_id, date, approved_by_manager')
        .eq('job_id', jobId)
        .eq('is_active', true);

      if (error) throw error;

      const techApprovals = new Map<string, boolean[]>();
      (data || []).forEach(t => {
        if (!t.technician_id) return;
        const current = techApprovals.get(t.technician_id) || [];
        current.push(t.approved_by_manager || false);
        techApprovals.set(t.technician_id, current);
      });

      const approvalMap = new Map<string, boolean>();
      techApprovals.forEach((statuses, techId) => {
        const allApproved = statuses.length > 0 && statuses.every(s => s === true);
        approvalMap.set(techId, allApproved);
      });

      return approvalMap;
    },
    staleTime: 30 * 1000,
  });

  const { data: technicianTimesheetDatesMap = new Map<string, string[]>() } = useQuery({
    queryKey: queryKeys.scope('job-tech-timesheet-dates', jobId),
    enabled: !!jobId && !jobMetaLoading,
    queryFn: async () => {
      const tourDateQuery = jobMeta?.tour_date_id
        ? dataLayerClient.from('tour_dates')
          .select('start_date, end_date, date')
          .eq('id', jobMeta.tour_date_id)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [timesheetResult, assignmentResult, dateTypeResult, tourDateResult] = await Promise.all([
        dataLayerClient.from('timesheets')
          .select('technician_id, date')
          .eq('job_id', jobId)
          .eq('is_active', true),
        dataLayerClient.from('job_assignments')
          .select('technician_id, single_day, assignment_date')
          .eq('job_id', jobId),
        dataLayerClient.from('job_date_types')
          .select('date, type')
          .eq('job_id', jobId),
        tourDateQuery,
      ]);

      if (timesheetResult.error) throw timesheetResult.error;
      if (assignmentResult.error) throw assignmentResult.error;
      if (dateTypeResult.error) throw dateTypeResult.error;
      if (tourDateResult.error) throw tourDateResult.error;

      const byTech = new Map<string, Set<string>>();
      const activeTimesheetDatesByTech = new Map<string, Set<string>>();
      const singleDayDatesByTech = new Map<string, Set<string>>();
      const technicianIds = new Set<string>();

      const timesheetRows = (timesheetResult.data || []) as PayoutDateTimesheetRow[];
      const assignmentRows = (assignmentResult.data || []) as PayoutDateAssignmentRow[];
      const dateTypeRows = (dateTypeResult.data || []) as PayoutDateTypeRow[];
      const tourDate = tourDateResult.data as PayoutTourDateRow | null;

      const prepDates = new Set(
        dateTypeRows
          .filter((row) => row.type === 'prep_day')
          .map((row) => toMadridDateKey(row.date))
          .filter((date): date is string => Boolean(date)),
      );

      const addDateToMap = (map: Map<string, Set<string>>, techId: string, date: string) => {
        if (!map.has(techId)) {
          map.set(techId, new Set());
        }
        map.get(techId)!.add(date);
      };

      const addPayableDate = (techId: string | null | undefined, rawDate: string | null | undefined) => {
        if (!techId) return;
        const date = toMadridDateKey(rawDate);
        if (!date || prepDates.has(date)) return;
        technicianIds.add(techId);
        addDateToMap(byTech, techId, date);
      };

      timesheetRows.forEach((row) => {
        const date = toMadridDateKey(row.date);
        if (!row.technician_id || !date || prepDates.has(date)) return;
        technicianIds.add(row.technician_id);
        addDateToMap(activeTimesheetDatesByTech, row.technician_id, date);
        addDateToMap(byTech, row.technician_id, date);
      });

      assignmentRows.forEach((row) => {
        if (!row.technician_id) return;
        technicianIds.add(row.technician_id);
        if (!row.single_day) return;

        const date = toMadridDateKey(row.assignment_date);
        if (!date || prepDates.has(date)) return;
        addDateToMap(singleDayDatesByTech, row.technician_id, date);
        addDateToMap(byTech, row.technician_id, date);
      });

      const rawScheduledRows = dateTypeRows
        .map((row) => ({ date: toMadridDateKey(row.date), type: row.type }))
        .filter((row): row is { date: string; type: string } => Boolean(row.date) && Boolean(row.type) && row.type !== 'prep_day');
      const hasScheduledDateTypes = rawScheduledRows.length > 0;
      const scheduledDates = rawScheduledRows
        .filter((row) => row.type !== 'rigging')
        .map((row) => row.date);
      const riggingDates = rawScheduledRows
        .filter((row) => row.type === 'rigging')
        .map((row) => row.date);

      const jobStartDate = toMadridDateKey(jobMeta?.start_time);
      const jobEndDate = toMadridDateKey(jobMeta?.end_time) ?? jobStartDate;
      const scheduleStart = toMadridDateKey(tourDate?.start_date)
        ?? jobStartDate
        ?? toMadridDateKey(tourDate?.date);
      const scheduleEnd = toMadridDateKey(tourDate?.end_date)
        ?? jobEndDate
        ?? toMadridDateKey(tourDate?.start_date)
        ?? toMadridDateKey(tourDate?.date)
        ?? jobStartDate;
      const fallbackScheduleDates = hasScheduledDateTypes
        ? []
        : enumerateDateRange(scheduleStart, scheduleEnd).filter((date) => !prepDates.has(date));

      technicianIds.forEach((techId) => {
        if ((singleDayDatesByTech.get(techId)?.size ?? 0) > 0) return;

        scheduledDates.forEach((date) => addPayableDate(techId, date));
        riggingDates.forEach((date) => {
          if (activeTimesheetDatesByTech.get(techId)?.has(date)) {
            addPayableDate(techId, date);
          }
        });
        fallbackScheduleDates.forEach((date) => addPayableDate(techId, date));
      });

      return new Map(
        Array.from(byTech.entries()).map(([techId, dates]) => [techId, Array.from(dates).sort(compareDateKeys)]),
      );
    },
    staleTime: 30_000,
  });

  /* ── Standard tech days (approved + total) ── */
  const { data: techDaysMaps = { approved: new Map<string, number>(), total: new Map<string, number>() } } = useQuery({
    queryKey: queryKeys.scope('job-tech-days', jobId),
    enabled: !!jobId && !isTourDate && !jobMetaLoading,
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('timesheets')
        .select('technician_id, date, approved_by_manager, status')
        .eq('job_id', jobId)
        .eq('is_active', true);
      if (error) throw error;

      const approvedMap = new Map<string, Set<string>>();
      const totalMap = new Map<string, Set<string>>();
      data?.forEach(row => {
        if (!row.technician_id || !row.date) return;
        if (!totalMap.has(row.technician_id)) totalMap.set(row.technician_id, new Set());
        totalMap.get(row.technician_id)!.add(row.date);
        if (row.approved_by_manager) {
          if (!approvedMap.has(row.technician_id)) approvedMap.set(row.technician_id, new Set());
          approvedMap.get(row.technician_id)!.add(row.date);
        }
      });

      const approvedCount = new Map<string, number>();
      approvedMap.forEach((dates, tech) => { approvedCount.set(tech, dates.size); });
      const totalCount = new Map<string, number>();
      totalMap.forEach((dates, tech) => { totalCount.set(tech, dates.size); });
      return { approved: approvedCount, total: totalCount };
    },
    staleTime: 60_000,
  });
  const techDaysMap = techDaysMaps.approved;
  const techTotalDaysMap = techDaysMaps.total;

  /* ── Tour date expenses (fetched separately since tour quotes don't include expenses) ── */
  const { data: tourExpenseData = new Map<string, { total: number; breakdown: JobExpenseBreakdownItem[] }>() } = useQuery({
    queryKey: queryKeys.scope('job-tech-expenses', jobId),
    enabled: !!jobId && isTourDate,
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('v_job_expense_summary')
        .select('*')
        .eq('job_id', jobId);
      if (error) throw error;

      const map = new Map<string, { total: number; breakdown: JobExpenseBreakdownItem[] }>();
      (data || []).forEach((row) => {
        if (!row.technician_id) return;
        const existing = map.get(row.technician_id) || { total: 0, breakdown: [] };
        const approvedAmount = Number(row.approved_total_eur ?? 0);
        existing.total += approvedAmount;
        existing.breakdown.push({
          category_slug: row.category_slug || 'otros',
          status_counts: (row.status_counts ?? undefined) as Record<string, number> | undefined,
          amount_totals: (row.amount_totals ?? undefined) as Record<string, number> | undefined,
          approved_total_eur: approvedAmount,
          submitted_total_eur: Number(row.submitted_total_eur ?? 0),
          draft_total_eur: Number(row.draft_total_eur ?? 0),
          rejected_total_eur: Number(row.rejected_total_eur ?? 0),
          last_receipt_at: row.last_receipt_at ?? null,
        });
        map.set(row.technician_id, existing);
      });
      return map;
    },
    staleTime: 30_000,
  });

  /* ── Tour quotes → visible + converted totals ── */
  const visibleTourQuotes = React.useMemo(() => {
    const quotes = (rawTourQuotes as TourJobRateQuote[]) || [];
    if (technicianId) {
      return quotes.filter((quote) => quote.technician_id === technicianId);
    }
    return quotes;
  }, [rawTourQuotes, technicianId]);

  const tourPayoutTotals = React.useMemo<JobPayoutTotals[]>(() => {
    return visibleTourQuotes.map((quote) => {
      const baseTotal = Number(quote.total_eur ?? 0);
      const extrasTotal = Number(
        quote.extras_total_eur ?? (quote.extras?.total_eur != null ? quote.extras.total_eur : 0)
      );
      const extrasBreakdown =
        quote.extras != null
          ? (quote.extras as JobPayoutTotals['extras_breakdown'])
          : ({ items: [], total_eur: extrasTotal } as JobPayoutTotals['extras_breakdown']);

      const techExpenses = tourExpenseData.get(quote.technician_id);
      const expensesTotal = techExpenses?.total ?? 0;
      const totalWithExtrasAndExpenses = baseTotal + extrasTotal + expensesTotal;

      return {
        job_id: quote.job_id,
        technician_id: quote.technician_id,
        timesheets_total_eur: baseTotal,
        extras_total_eur: extrasTotal,
        total_eur: totalWithExtrasAndExpenses,
        extras_breakdown: {
          items: extrasBreakdown.items ?? [],
          total_eur: extrasBreakdown.total_eur ?? extrasTotal,
        },
        vehicle_disclaimer: Boolean(quote.vehicle_disclaimer),
        vehicle_disclaimer_text: quote.vehicle_disclaimer_text ?? undefined,
        payout_approved: tourApprovals.get(quote.technician_id) ?? false,
        expenses_total_eur: expensesTotal,
        expenses_breakdown: techExpenses?.breakdown ?? [],
      } satisfies JobPayoutTotals;
    });
  }, [visibleTourQuotes, tourApprovals, tourExpenseData]);

  const payoutTotals = isTourDate ? tourPayoutTotals : standardPayoutTotals;
  const isLoading = jobMetaLoading || (isTourDate ? tourQuotesLoading : standardLoading);
  const error = jobMetaError ?? (isTourDate ? tourQuotesError : standardError);

  const { data: prepDaysMap = new Map<string, number>() } = useQuery({
    queryKey: queryKeys.scope('job-tech-prep-days', jobId),
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('timesheets')
        .select('technician_id, amount_eur, amount_breakdown, approved_by_manager')
        .eq('job_id', jobId)
        .eq('is_active', true)
        .eq('approved_by_manager', true);
      if (error) throw error;
      const map = new Map<string, number>();
      const rows = (data || []) as TimesheetRow[];
      rows.forEach((row) => {
        if (!row.technician_id) return;
        if (!isPrepDayBreakdown(row.amount_breakdown)) return;
        map.set(row.technician_id, (map.get(row.technician_id) || 0) + Number(row.amount_eur || 0));
      });
      return map;
    },
    staleTime: 30_000,
  });

  const payoutTotalsWithPrep = React.useMemo(
    () =>
      payoutTotals.map((p) => {
        const prepDaysTotal = prepDaysMap.get(p.technician_id) || 0;

        if (!isTourDate || prepDaysTotal <= 0) {
          return {
            ...p,
            prep_days_total_eur: prepDaysTotal,
          };
        }

        // Tour quotes intentionally exclude prep_day from multiplier math and
        // base quote totals. Prep days are approved fixed-rate timesheets, so
        // they must be added back into the technician payout exactly once here.
        return {
          ...p,
          timesheets_total_eur: Number(p.timesheets_total_eur || 0) + prepDaysTotal,
          total_eur: Number(p.total_eur || 0) + prepDaysTotal,
          prep_days_total_eur: prepDaysTotal,
        };
      }),
    [payoutTotals, prepDaysMap, isTourDate]
  );

  /* ── Flex LPO data ── */
  const { data: lpoRows = [] } = useQuery({
    queryKey: queryKeys.scope('flex-work-orders-by-job', jobId, technicianId),
    queryFn: async () => {
      let q = dataLayerClient.from('flex_work_orders').select('technician_id, lpo_number, flex_element_id').eq('job_id', jobId);
      if (technicianId) q = q.eq('technician_id', technicianId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Array<{ technician_id: string; lpo_number: string | null; flex_element_id: string | null }>;
    },
    enabled: !!jobId,
    staleTime: 30_000,
  });
  const lpoMap = React.useMemo(() => new Map(lpoRows.map((r) => [r.technician_id, r.lpo_number || null])), [lpoRows]);
  const flexElementMap = React.useMemo(
    () => new Map(lpoRows.map((r) => [r.technician_id, r.flex_element_id || null])),
    [lpoRows]
  );
  const buildFinDocUrl = React.useCallback((elementId: string | null | undefined) => {
    if (!elementId) return null;
    return `${FLEX_UI_BASE_URL}#fin-doc/${encodeURIComponent(elementId)}/doc-view/${FIN_DOC_VIEW_ID}/detail`;
  }, []);

  /* ── Profiles ── */
  const techIds = React.useMemo(
    () => Array.from(new Set(payoutTotalsWithPrep.map((p) => p.technician_id).filter(Boolean))) as string[],
    [payoutTotalsWithPrep]
  );
  const { data: profiles = [] } = useQuery({
    queryKey: queryKeys.scope('profiles-for-job-payout', jobId, techIds),
    enabled: techIds.length > 0,
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('profiles')
        .select('id, first_name, last_name, email, autonomo, department')
        .in('id', techIds);
      if (error) throw error;
      return (data || []) as TechnicianProfileWithEmail[];
    },
    staleTime: 60_000,
  });
  const profilesWithEmail = profiles as TechnicianProfileWithEmail[];
  const autonomoMap = React.useMemo(
    () => new Map(profilesWithEmail.map((p) => [p.id, p.autonomo ?? null])),
    [profilesWithEmail]
  );
  const profileMap = React.useMemo(() => new Map(profilesWithEmail.map((p) => [p.id, p])), [profilesWithEmail]);
  const getTechName = React.useCallback(
    (id: string) => {
      const p = profileMap.get(id);
      if (!p) return id;
      const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
      return name || id;
    },
    [profileMap]
  );

  /* ── Payout overrides ── */
  const { data: payoutOverrides = [] } = useJobTechnicianPayoutOverrides(jobId);

  const { data: overrideActorMap = new Map<string, { name: string; email: string | null }>() } = useQuery({
    queryKey: queryKeys.scope('job-tech-payout-overrides', jobId, 'actors'),
    enabled: isManager && payoutOverrides.length > 0,
    queryFn: async () => {
      const actorIds = Array.from(new Set(payoutOverrides.map((o) => o.set_by).filter(Boolean))) as string[];
      if (!actorIds.length) return new Map();

      const { data, error } = await dataLayerClient.from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', actorIds);
      if (error) throw error;

      const map = new Map<string, { name: string; email: string | null }>();
      (data || []).forEach((p: { id: string; first_name: string | null; last_name: string | null; email: string | null }) => {
        const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.id;
        map.set(p.id, { name, email: p.email ?? null });
      });
      return map;
    },
    staleTime: 60_000,
  });

  const getTechOverride = React.useCallback((techId: string) => {
    return payoutOverrides.find(o => o.technician_id === techId);
  }, [payoutOverrides]);

  /* ── Rehearsal dates ── */
  const { data: rehearsalDates = [] } = useJobRehearsalDates(jobId, { enabled: isManager && !jobMetaLoading });
  const toggleDateRehearsalMutation = useToggleDateRehearsalRate();
  const toggleAllDatesRehearsalMutation = useToggleAllDatesRehearsalRate();

  const rehearsalDateSet = React.useMemo(
    () => new Set(rehearsalDates.map(r => r.date)),
    [rehearsalDates]
  );

  const { data: jobTimesheetDates = [] } = useQuery({
    queryKey: queryKeys.scope('job-timesheet-dates', jobId),
    enabled: !!jobId && !jobMetaLoading && isManager,
    queryFn: async () => {
      const { data: scheduledRows, error: scheduledError } = await dataLayerClient.from('job_date_types')
        .select('date')
        .eq('job_id', jobId);

      if (scheduledError) throw scheduledError;

      const { data: timesheetRows, error } = await dataLayerClient.from('timesheets')
        .select('date')
        .eq('job_id', jobId)
        .eq('is_active', true);
      if (error) throw error;

      const uniqueDates = Array.from(new Set([
        ...(scheduledRows || []).map((row) => row.date).filter(Boolean),
        ...(timesheetRows || []).map((row) => row.date).filter(Boolean),
      ])) as string[];

      return uniqueDates.sort();
    },
    staleTime: 60_000,
  });

  const allDatesMarked = React.useMemo(
    () => jobTimesheetDates.length > 0 && jobTimesheetDates.every(date => rehearsalDateSet.has(date)),
    [jobTimesheetDates, rehearsalDateSet]
  );

  /* ── Admin-only technician/date rate-mode exceptions (tour dates + standard jobs) ── */
  const shouldProbeTechnicianRateModes =
    !!jobId && !jobMetaLoading && (isManager || isAdminOrAdministrative);
  const {
    data: technicianRateModeDates = [],
    error: technicianRateModeError,
  } = useJobTechnicianRateModeDates(jobId, {
    enabled: shouldProbeTechnicianRateModes,
  });
  const setTechnicianRateModeMutation = useSetTechnicianDateRateMode();
  const canViewTechnicianRateModePanel = shouldProbeTechnicianRateModes && !technicianRateModeError;

  const technicianRateModeMap = React.useMemo(() => {
    const map = new Map<string, Map<string, TechnicianDateRateMode>>();

    technicianRateModeDates.forEach((row) => {
      if (!map.has(row.technician_id)) {
        map.set(row.technician_id, new Map());
      }

      // rate_mode is the source of truth; fall back to the legacy boolean for
      // any pre-migration row that somehow lacks it.
      const mode = (row.rate_mode ?? (row.use_rehearsal_rate ? 'rehearsal' : 'standard')) as TechnicianDateRateMode;
      map.get(row.technician_id)!.set(row.date, mode);
    });

    return map;
  }, [technicianRateModeDates]);

  const technicianRateModeFixedMap = React.useMemo(() => {
    const map = new Map<string, Map<string, number | null>>();
    technicianRateModeDates.forEach((row) => {
      if (!map.has(row.technician_id)) {
        map.set(row.technician_id, new Map());
      }
      map.get(row.technician_id)!.set(row.date, row.fixed_amount_eur ?? null);
    });
    return map;
  }, [technicianRateModeDates]);

  const getTechRateModeDateSelection = React.useCallback((techId: string, date: string): TechnicianDateRateMode => {
    return technicianRateModeMap.get(techId)?.get(date) ?? 'inherit';
  }, [technicianRateModeMap]);

  const getTechRateModeFixedAmount = React.useCallback((techId: string, date: string): number | null => {
    return technicianRateModeFixedMap.get(techId)?.get(date) ?? null;
  }, [technicianRateModeFixedMap]);

  /* ── Grand total ── */
  const calculatedGrandTotal = React.useMemo(() => {
    return payoutTotalsWithPrep.reduce((sum, payout) => {
      const override = payoutOverrides.find(o => o.technician_id === payout.technician_id);

      let deduction = 0;
      const isNonAutonomo = autonomoMap.get(payout.technician_id) === false;
      if (isNonAutonomo && !override && !isTourDate) {
        const days = techDaysMap.get(payout.technician_id) || (payout.timesheets_total_eur > 0 ? 1 : 0);
        deduction = days * NON_AUTONOMO_DEDUCTION_EUR;
      }

      const effectiveTotal = (override?.override_amount_eur ?? payout.total_eur) - (override ? 0 : deduction);
      return sum + effectiveTotal;
    }, 0);
  }, [payoutTotalsWithPrep, payoutOverrides, autonomoMap, isTourDate, techDaysMap]);

  return {
    jobMeta,
    isTourDate,
    isLoading,
    error: error as Error | null,
    isClosureLocked,
    payoutTotals: payoutTotalsWithPrep,
    visibleTourQuotes,
    profilesWithEmail,
    profileMap,
    autonomoMap,
    getTechName,
    lpoMap,
    flexElementMap,
    buildFinDocUrl,
    techDaysMap,
    techTotalDaysMap,
    technicianTimesheetDatesMap,
    payoutOverrides,
    overrideActorMap,
    getTechOverride,
    calculatedGrandTotal,
    isManager,
    isAdmin,
    canViewTechnicianRateModePanel,
    isAdminOrAdministrative,
    userDepartment,
    rehearsalDateSet,
    jobTimesheetDates,
    allDatesMarked,
    toggleDateRehearsalMutation,
    toggleAllDatesRehearsalMutation,
    getTechRateModeDateSelection,
    getTechRateModeFixedAmount,
    setTechnicianRateModeMutation,
    standardPayoutTotals,
  };
}
