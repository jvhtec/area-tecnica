import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { invalidateRehearsalRateQueries, recalculateTimesheets } from '@/hooks/useToggleJobRehearsalRate';


import { queryKeys } from "@/lib/react-query";

/**
 * Per-technician/per-date rate exception modes.
 * - `inherit`          → no row; follow the job-wide rehearsal toggle.
 * - `rehearsal`        → force the rehearsal flat rate.
 * - `standard`         → force the standard day/hours rate.
 * - `tour_multipliers` → force tour multipliers even off the full-week tour team.
 * - `no_multipliers`   → force the plain base day rate (multiplier 1.0).
 * - `hourly`           → price from the timesheet's worked hours (auto-creates a draft).
 * - `fixed`            → use a custom fixed EUR amount.
 */
export type TechnicianDateRateMode =
  | 'inherit'
  | 'rehearsal'
  | 'standard'
  | 'tour_multipliers'
  | 'no_multipliers'
  | 'hourly'
  | 'fixed';

/** Modes that price a date from a real timesheet, so one must exist. */
const MODES_NEEDING_TIMESHEET: TechnicianDateRateMode[] = ['hourly'];

// The generated Supabase types lag behind the migration that adds rate_mode /
// fixed_amount_eur, so widen the row locally instead of editing types.ts.
type TechnicianRateModeRow = Tables<'job_technician_rate_mode_dates'> & {
  rate_mode: TechnicianDateRateMode;
  fixed_amount_eur: number | null;
};

interface UseJobTechnicianRateModeDatesOptions {
  enabled?: boolean;
}

export function useJobTechnicianRateModeDates(
  jobId: string,
  options: UseJobTechnicianRateModeDatesOptions = {},
) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.scope('job-technician-rate-mode-dates', jobId),
    enabled: !!jobId && enabled,
    queryFn: async (): Promise<TechnicianRateModeRow[]> => {
      const { data, error } = await supabase
        .from('job_technician_rate_mode_dates')
        .select('job_id, technician_id, date, use_rehearsal_rate, rate_mode, fixed_amount_eur, created_at, created_by, updated_at, updated_by')
        .eq('job_id', jobId);

      if (error) throw error;
      return (data || []) as unknown as TechnicianRateModeRow[];
    },
    staleTime: 30_000,
  });
}

interface SetTechnicianDateRateModeParams {
  jobId: string;
  technicianId: string;
  date: string;
  mode: TechnicianDateRateMode;
  /** Required when mode === 'fixed'. */
  fixedAmountEur?: number | null;
}

/**
 * Ensures an active timesheet exists for the job/date/tech, creating a draft if
 * not. Mirrors the insert shape used by useTimesheets.createTimesheet so the DB
 * trigger resolves the category and default times. Returns the affected
 * timesheet ids so the caller can recalculate them.
 */
async function ensureTimesheetForDate(
  jobId: string,
  technicianId: string,
  date: string,
): Promise<string[]> {
  const { data: existing, error: existingError } = await supabase
    .from('timesheets')
    .select('id, is_active')
    .eq('job_id', jobId)
    .eq('technician_id', technicianId)
    .eq('date', date);

  if (existingError) throw existingError;

  if (existing && existing.length > 0) {
    const inactiveIds = existing.filter((row) => !row.is_active).map((row) => row.id);
    if (inactiveIds.length > 0) {
      const { error: reactivateError } = await supabase
        .from('timesheets')
        .update({ is_active: true, source: 'hourly_rate_override' })
        .in('id', inactiveIds);
      if (reactivateError) throw reactivateError;
    }
    return existing.map((row) => row.id);
  }

  const { data: created, error: createError } = await supabase
    .from('timesheets')
    .insert({
      job_id: jobId,
      technician_id: technicianId,
      date,
      created_by: (await supabase.auth.getUser()).data.user?.id,
      source: 'hourly_rate_override',
    })
    .select('id')
    .single();

  if (createError) throw createError;
  return created ? [created.id] : [];
}

export function useSetTechnicianDateRateMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, technicianId, date, mode, fixedAmountEur }: SetTechnicianDateRateModeParams) => {
      let createdTimesheet = false;
      const normalizedFixedAmount =
        mode === 'fixed' && fixedAmountEur != null ? Math.round(Number(fixedAmountEur) * 100) / 100 : null;

      if (mode === 'fixed' && (normalizedFixedAmount == null || !Number.isFinite(normalizedFixedAmount) || normalizedFixedAmount < 0)) {
        throw new Error('A non-negative fixed amount is required');
      }

      if (mode === 'inherit') {
        const { error } = await supabase
          .from('job_technician_rate_mode_dates')
          .delete()
          .eq('job_id', jobId)
          .eq('technician_id', technicianId)
          .eq('date', date);

        if (error) throw error;
      } else {
        const upsertRow: Record<string, unknown> = {
          job_id: jobId,
          technician_id: technicianId,
          date,
          rate_mode: mode,
          // Maintain the legacy boolean so any unmigrated reader still works.
          use_rehearsal_rate: mode === 'rehearsal',
          fixed_amount_eur: normalizedFixedAmount,
        };

        const { error } = await supabase
          .from('job_technician_rate_mode_dates')
          // Cast: rate_mode/fixed_amount_eur are not yet in the generated types.
          .upsert(upsertRow as never, { onConflict: 'job_id,technician_id,date' });

        if (error) throw error;

        // Modes priced from a real timesheet must have one to surface.
        if (MODES_NEEDING_TIMESHEET.includes(mode)) {
          const before = await supabase
            .from('timesheets')
            .select('id')
            .eq('job_id', jobId)
            .eq('technician_id', technicianId)
            .eq('date', date)
            .eq('is_active', true);
          const hadTimesheet = (before.data?.length ?? 0) > 0;
          await ensureTimesheetForDate(jobId, technicianId, date);
          createdTimesheet = !hadTimesheet;
        }
      }

      const { data: timesheets, error: timesheetError } = await supabase
        .from('timesheets')
        .select('id')
        .eq('job_id', jobId)
        .eq('technician_id', technicianId)
        .eq('date', date)
        .eq('is_active', true);

      if (timesheetError) throw timesheetError;

      const recalculated = await recalculateTimesheets(
        timesheets?.map((timesheet) => timesheet.id) ?? [],
      );

      return { jobId, technicianId, date, mode, recalculated, createdTimesheet };
    },
    onSuccess: (result) => {
      invalidateRehearsalRateQueries(queryClient, result.jobId);
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('job-technician-rate-mode-dates', result.jobId) });
      if (result.createdTimesheet) {
        toast.success('Se creó un parte en borrador para introducir horas');
      }
    },
    onError: (error) => {
      console.error('[useSetTechnicianDateRateMode] Error:', error);
      toast.error('No se pudo actualizar la tarifa por técnico para esta fecha');
    },
  });
}
