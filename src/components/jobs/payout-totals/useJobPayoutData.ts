import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useJobPayoutTotals } from '@/hooks/useJobPayoutTotals';
import { useManagerJobQuotes } from '@/hooks/useManagerJobQuotes';
import { useJobTechnicianPayoutOverrides } from '@/hooks/useJobPayoutOverride';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useJobRehearsalDates, useToggleDateRehearsalRate, useToggleAllDatesRehearsalRate } from '@/hooks/useToggleJobRehearsalRate';
import type { TechnicianProfileWithEmail } from '@/lib/job-payout-email';
import { isJobPastClosureWindow } from '@/utils/jobClosureUtils';
import type { JobPayoutTotals, JobExpenseBreakdownItem } from '@/types/jobExtras';
import type { TourJobRateQuote } from '@/types/tourRates';
import { FLEX_UI_BASE_URL } from '@/utils/flexUrlResolver';
import type { JobMetadata, JobPayoutData } from './types';
import { NON_AUTONOMO_DEDUCTION_EUR } from './types';
const FIN_DOC_VIEW_ID = '8238f39c-f42e-11e0-a8de-00e08175e43e';

export function useJobPayoutData(jobId: string, technicianId?: string): JobPayoutData {
  /* ── Auth ── */
  const { userRole } = useOptimizedAuth();
  const isManager = userRole === 'admin' || userRole === 'management';

  /* ── Job metadata ── */
  const {
    data: jobMeta,
    isLoading: jobMetaLoading,
    error: jobMetaError,
  } = useQuery({
    queryKey: ['job-payout-metadata', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, start_time, end_time, timezone, tour_id, rates_approved, job_type, invoicing_company')
        .eq('id', jobId)
        .maybeSingle();
      if (error) throw error;
      return data as JobMetadata;
    },
    staleTime: 60_000,
  });

  const jobType = jobMeta?.job_type ?? null;
  const isTourDate = jobType === 'tourdate';
  const isClosureLocked = isJobPastClosureWindow(jobMeta?.end_time, jobMeta?.timezone ?? 'Europe/Madrid');
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

  /* ── Tour timesheet data (approvals + day counts) ── */
  const { data: tourTimesheetData = { approvals: new Map<string, boolean>(), daysCounts: new Map<string, number>() } } = useQuery({
    queryKey: ['job-tech-payout', jobId, 'tour-timesheet-data'],
    enabled: !!jobId && isTourDate,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timesheets')
        .select('technician_id, date, approved_by_manager')
        .eq('job_id', jobId)
        .eq('is_active', true);

      if (error) throw error;

      const techApprovals = new Map<string, boolean[]>();
      const techDates = new Map<string, Set<string>>();
      (data || []).forEach(t => {
        if (!t.technician_id) return;
        const current = techApprovals.get(t.technician_id) || [];
        current.push(t.approved_by_manager || false);
        techApprovals.set(t.technician_id, current);
        if (t.date) {
          if (!techDates.has(t.technician_id)) techDates.set(t.technician_id, new Set());
          techDates.get(t.technician_id)!.add(t.date);
        }
      });

      const approvalMap = new Map<string, boolean>();
      techApprovals.forEach((statuses, techId) => {
        const allApproved = statuses.length > 0 && statuses.every(s => s === true);
        approvalMap.set(techId, allApproved);
      });

      const daysCountMap = new Map<string, number>();
      techDates.forEach((dates, techId) => { daysCountMap.set(techId, dates.size); });

      return { approvals: approvalMap, daysCounts: daysCountMap };
    },
    staleTime: 30 * 1000,
  });
  const tourApprovals = tourTimesheetData.approvals;
  const tourTimesheetDays = tourTimesheetData.daysCounts;

  /* ── Standard tech days (approved + total) ── */
  const { data: techDaysMaps = { approved: new Map<string, number>(), total: new Map<string, number>() } } = useQuery({
    queryKey: ['job-tech-days', jobId],
    enabled: !!jobId && !isTourDate && !jobMetaLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timesheets')
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
    queryKey: ['job-tech-expenses', jobId],
    enabled: !!jobId && isTourDate,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_job_expense_summary')
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
      const isRehearsalFlat = quote.category === 'rehearsal';
      const scheduledDays = isRehearsalFlat
        ? (tourTimesheetDays.get(quote.technician_id) || 1)
        : 1;

      const perDayRate = Number(quote.total_eur ?? 0);
      const baseTotal = perDayRate * scheduledDays;
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
  }, [visibleTourQuotes, tourApprovals, tourTimesheetDays, tourExpenseData]);

  const payoutTotals = isTourDate ? tourPayoutTotals : standardPayoutTotals;
  const isLoading = jobMetaLoading || (isTourDate ? tourQuotesLoading : standardLoading);
  const error = jobMetaError ?? (isTourDate ? tourQuotesError : standardError);

  /* ── Flex LPO data ── */
  const { data: lpoRows = [] } = useQuery({
    queryKey: ['flex-work-orders-by-job', jobId, technicianId],
    queryFn: async () => {
      let q = supabase.from('flex_work_orders').select('technician_id, lpo_number, flex_element_id').eq('job_id', jobId);
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
    () => Array.from(new Set(payoutTotals.map((p) => p.technician_id).filter(Boolean))) as string[],
    [payoutTotals]
  );
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-job-payout', jobId, techIds],
    enabled: techIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, autonomo')
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
    queryKey: ['job-tech-payout-overrides', jobId, 'actors'],
    enabled: isManager && payoutOverrides.length > 0,
    queryFn: async () => {
      const actorIds = Array.from(new Set(payoutOverrides.map((o) => o.set_by).filter(Boolean))) as string[];
      if (!actorIds.length) return new Map();

      const { data, error } = await supabase
        .from('profiles')
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
    queryKey: ['job-timesheet-dates', jobId],
    enabled: !!jobId && !jobMetaLoading && isManager,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timesheets')
        .select('date')
        .eq('job_id', jobId)
        .eq('is_active', true);
      if (error) throw error;
      const uniqueDates = Array.from(new Set((data || []).map(t => t.date).filter(Boolean))) as string[];
      return uniqueDates.sort();
    },
    staleTime: 60_000,
  });

  const allDatesMarked = React.useMemo(
    () => jobTimesheetDates.length > 0 && jobTimesheetDates.every(date => rehearsalDateSet.has(date)),
    [jobTimesheetDates, rehearsalDateSet]
  );

  /* ── Grand total ── */
  const calculatedGrandTotal = React.useMemo(() => {
    return payoutTotals.reduce((sum, payout) => {
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
  }, [payoutTotals, payoutOverrides, autonomoMap, isTourDate, techDaysMap]);

  return {
    jobMeta,
    isTourDate,
    isLoading,
    error: error as Error | null,
    isClosureLocked,
    payoutTotals,
    visibleTourQuotes,
    tourTimesheetDays,
    profilesWithEmail,
    profileMap,
    autonomoMap,
    getTechName,
    lpoMap,
    flexElementMap,
    buildFinDocUrl,
    techDaysMap,
    techTotalDaysMap,
    payoutOverrides,
    overrideActorMap,
    getTechOverride,
    calculatedGrandTotal,
    isManager,
    rehearsalDateSet,
    jobTimesheetDates,
    allDatesMarked,
    toggleDateRehearsalMutation,
    toggleAllDatesRehearsalMutation,
    standardPayoutTotals,
  };
}
