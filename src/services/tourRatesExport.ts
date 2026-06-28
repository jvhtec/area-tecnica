import { supabase } from '@/integrations/supabase/client';
import { syncFlexWorkOrdersForJob } from '@/services/flexWorkOrders';
import type { TourJobRateQuote } from '@/types/tourRates';
import { attachPayoutOverridesToTourQuotes } from '@/services/tourPayoutOverrides';

// Timesheet amount breakdown blob (all fields optional; values may be numeric or
// numeric strings depending on source). Used only for read/coercion here.
type AmountBreakdown = {
  hours_rounded?: number | string | null;
  worked_hours_rounded?: number | string | null;
  plus_10_12_amount_eur?: number | string | null;
  plus_10_12_eur?: number | string | null;
  overtime_hours?: number | string | null;
  overtime_amount_eur?: number | string | null;
};

type TimesheetBreakdownRow = {
  id: string;
  job_id?: string;
  technician_id: string | null;
  approved_by_manager?: boolean | null;
  amount_breakdown?: AmountBreakdown | null;
  amount_breakdown_visible?: AmountBreakdown | null;
};

type LpoRow = { technician_id: string; lpo_number: string | null };

// Loosely-typed row returned by the rate-quote RPC; values are coerced below.
// extras/vehicle_disclaimer/breakdown reuse the output contract so they assign cleanly.
type RpcQuoteRow = {
  job_id?: string;
  technician_id?: string;
  start_time?: string;
  end_time?: string;
  job_type?: string;
  tour_id?: string;
  title?: string;
  is_house_tech?: boolean;
  is_tour_team_member?: boolean;
  category?: string;
  base_day_eur?: number | string | null;
  week_count?: number | string | null;
  multiplier?: number | string | null;
  per_job_multiplier?: number | string | null;
  iso_year?: number | null;
  iso_week?: number | null;
  total_eur?: number | string | null;
  extras?: TourJobRateQuote['extras'];
  extras_total_eur?: number | string | null;
  total_with_extras_eur?: number | string | null;
  vehicle_disclaimer?: TourJobRateQuote['vehicle_disclaimer'];
  vehicle_disclaimer_text?: string;
  breakdown?: TourJobRateQuote['breakdown'];
};

export interface TourRatesExportJob {
  id: string;
  title: string;
  start_time: string;
  end_time?: string | null;
  job_type?: 'single' | 'tour' | 'tourdate' | 'festival' | 'ciclo' | 'dryhire' | string | null;
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
  raw: RpcQuoteRow
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
  per_job_multiplier:
    raw.per_job_multiplier != null ? Number(raw.per_job_multiplier) : undefined,
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

  // Opportunistic: if a non-tourdate job is already approved but has no LPO rows,
  // try to create the Flex work orders so the PDF can include LPO numbers.
  // This is a safe no-op if everything already exists.
  await Promise.all(
    jobs.map(async (j) => {
      const jt = String(j.job_type || '').toLowerCase();
      if (jt === 'tourdate') return;
      const jobLpo = lpoByJob.get(j.id);
      if (jobLpo && jobLpo.size > 0) return;
      try {
        const { data: jr } = await supabase
          .from('jobs')
          .select('id, rates_approved')
          .eq('id', j.id)
          .maybeSingle();
        if (!jr?.rates_approved) return;
        // Fire-and-forget; ignore errors here (export should still proceed)
        await syncFlexWorkOrdersForJob(j.id);
        const { data: refreshed } = await supabase
          .from('flex_work_orders')
          .select('job_id, technician_id, lpo_number')
          .eq('job_id', j.id);
        if (refreshed) {
          const map = new Map<string, string | null>();
          (refreshed as LpoRow[]).forEach((r) => map.set(r.technician_id, r.lpo_number));
          lpoByJob.set(j.id, map);
        }
      } catch (_) {
        // ignore errors, keep best effort
      }
    })
  );

  const jobsWithQuotes: TourJobQuotesWithLPO[] = [];

  for (const job of jobs) {
    const techIds = Array.from(assignmentsByJob.get(job.id) ?? []);
    if (techIds.length === 0) continue;

    let filteredQuotes: TourJobRateQuote[] = [];

    // If job is a tour date, use the tour quote RPC. Otherwise (e.g. 'single', 'festival')
    // build quotes from the payout view which aggregates approved timesheets + extras.
    const jobType = (job.job_type ?? '').toLowerCase();

    if (jobType === 'tourdate') {
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
              per_job_multiplier: 1,
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

          const raw = (data || {}) as RpcQuoteRow;
          return mapRpcResultToQuote(job.id, tourId, techId, raw);
        })
      );
      filteredQuotes = (quotes.filter(Boolean) as TourJobRateQuote[]).filter(q => q.technician_id);

      // Attach manual payout overrides (so PDFs reflect exceptions)
      filteredQuotes = await attachPayoutOverridesToTourQuotes(job.id, filteredQuotes);

      // Attach timesheet-derived hours/OT breakdown when available (informational only)
      const { data: ts } = await supabase
        .from('timesheets')
        .select('id, technician_id, approved_by_manager, amount_breakdown')
        .eq('job_id', job.id)
        .eq('is_active', true)
        .in('technician_id', techIds)
        .eq('approved_by_manager', true);
      const agg = new Map<string, { h: number; plus: number; otH: number; otAmt: number }>();
      if (ts && ts.length) {
        const toCompute: TimesheetBreakdownRow[] = [];
        (ts as TimesheetBreakdownRow[]).forEach((row) => {
          const tech = row.technician_id as string;
          const persisted = row.amount_breakdown ?? null;
          if (!persisted) toCompute.push(row);
          const b: AmountBreakdown = persisted ?? {};
          const h = Number(b.hours_rounded ?? b.worked_hours_rounded ?? 0) || 0;
          const plus =
            b.plus_10_12_amount_eur != null
              ? Number(b.plus_10_12_amount_eur) || 0
              : (Number(b.plus_10_12_eur ?? 0) || 0) * Math.min(Math.max(h - 10, 0), 2);
          const otH = Number(b.overtime_hours ?? 0) || 0;
          const otAmt = Number(b.overtime_amount_eur ?? 0) || 0;
          const cur = agg.get(tech) || { h: 0, plus: 0, otH: 0, otAmt: 0 };
          agg.set(tech, { h: cur.h + h, plus: cur.plus + plus, otH: cur.otH + otH, otAmt: cur.otAmt + otAmt });
        });
        if (toCompute.length) {
          const computed = await Promise.all(
            toCompute.map(async (row) => {
              const { data, error } = await supabase.rpc('compute_timesheet_amount_2025', {
                _timesheet_id: row.id,
                _persist: false,
              });
              return { tech: row.technician_id as string, br: error ? null : (data as AmountBreakdown | null) };
            })
          );
          computed.forEach(({ tech, br }) => {
            if (!tech || !br) return;
            const h = Number(br.hours_rounded ?? br.worked_hours_rounded ?? 0) || 0;
            const plus =
              br.plus_10_12_amount_eur != null
                ? Number(br.plus_10_12_amount_eur) || 0
                : (Number(br.plus_10_12_eur ?? 0) || 0) * Math.min(Math.max(h - 10, 0), 2);
            const otH = Number(br.overtime_hours ?? 0) || 0;
            const otAmt = Number(br.overtime_amount_eur ?? 0) || 0;
            const cur = agg.get(tech) || { h: 0, plus: 0, otH: 0, otAmt: 0 };
            agg.set(tech, { h: cur.h + h, plus: cur.plus + plus, otH: cur.otH + otH, otAmt: cur.otAmt + otAmt });
          });
        }
      }
      // Fallback to security-definer helper if direct timesheets access returned nothing
      if ((!ts || ts.length === 0) && agg.size === 0) {
        const { data: tsVisible } = await supabase.rpc('get_timesheet_amounts_visible');
        if (Array.isArray(tsVisible) && tsVisible.length) {
          (tsVisible as TimesheetBreakdownRow[])
            .filter((row) => row.job_id === job.id && techIds.includes(row.technician_id ?? '') && row.approved_by_manager === true)
            .forEach((row) => {
              const tech = row.technician_id as string;
              const b: AmountBreakdown = (row.amount_breakdown || row.amount_breakdown_visible) ?? {};
              const h = Number(b.hours_rounded ?? b.worked_hours_rounded ?? 0) || 0;
              const plus = h > 10 ? Number(b.plus_10_12_eur ?? 0) || 0 : 0;
              const otH = Number(b.overtime_hours ?? 0) || 0;
              const otAmt = Number(b.overtime_amount_eur ?? 0) || 0;
              const cur = agg.get(tech) || { h: 0, plus: 0, otH: 0, otAmt: 0 };
              agg.set(tech, { h: cur.h + h, plus: cur.plus + plus, otH: cur.otH + otH, otAmt: cur.otAmt + otAmt });
            });
        }
      }
      filteredQuotes = filteredQuotes.map((q) => ({
        ...q,
        breakdown: {
          ...(q.breakdown || {}),
          single_hours_total: agg.get(q.technician_id)?.h ?? 0,
          single_plus_10_12_total_eur: agg.get(q.technician_id)?.plus ?? 0,
          single_overtime_hours_total: agg.get(q.technician_id)?.otH ?? 0,
          single_overtime_amount_total_eur: agg.get(q.technician_id)?.otAmt ?? 0,
        },
      }));
    } else {
      // Non-tourdate job within a tour (single/festival/ciclo): use payout totals (timesheets + extras)
      const { data: payouts, error: payoutError } = await supabase
        .from('v_job_tech_payout_2025')
        .select('technician_id, timesheets_total_eur, extras_total_eur, total_eur, vehicle_disclaimer, vehicle_disclaimer_text')
        .eq('job_id', job.id)
        .in('technician_id', techIds);

      if (payoutError) {
        // Fallback to zeroed quotes on error to keep row in PDF
        filteredQuotes = techIds.map((techId): TourJobRateQuote => ({
          job_id: job.id,
          technician_id: techId,
          start_time: job.start_time,
          end_time: job.end_time ?? job.start_time,
          job_type: job.job_type || 'single',
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
          extras_total_eur: 0,
          total_with_extras_eur: 0,
          vehicle_disclaimer: undefined,
          vehicle_disclaimer_text: undefined,
          breakdown: {},
        }));
      } else {
        const breakdownByTech = new Map<string, {
          hours_total: number;
          plus_10_12_total_eur: number;
          overtime_hours_total: number;
          overtime_amount_total_eur: number;
        }>();

        // Approved-timesheet breakdowns come from the get_timesheet_amounts_visible
        // security-definer helper. (A direct `timesheets` select previously lived here
        // but requested a non-existent `amount_breakdown_visible` column, so it always
        // errored and this RPC was already the de-facto source; the dead path is removed.)
        if (breakdownByTech.size === 0) {
          const { data: tsVisible } = await supabase.rpc('get_timesheet_amounts_visible');
          if (Array.isArray(tsVisible) && tsVisible.length) {
            (tsVisible as TimesheetBreakdownRow[])
              .filter((row) => row.job_id === job.id && techIds.includes(row.technician_id ?? '') && row.approved_by_manager === true)
              .forEach((row) => {
                const tech = row.technician_id as string;
                const b: AmountBreakdown = (row.amount_breakdown || row.amount_breakdown_visible) ?? {};
                const hoursRounded = Number(b.hours_rounded ?? b.worked_hours_rounded ?? 0) || 0;
                const plusEur =
                  b.plus_10_12_amount_eur != null
                    ? Number(b.plus_10_12_amount_eur) || 0
                    : (Number(b.plus_10_12_eur ?? 0) || 0) * Math.min(Math.max(hoursRounded - 10, 0), 2);
                const otHours = Number(b.overtime_hours ?? 0) || 0;
                const otAmount = Number(b.overtime_amount_eur ?? 0) || 0;
                const acc = breakdownByTech.get(tech) || {
                  hours_total: 0,
                  plus_10_12_total_eur: 0,
                  overtime_hours_total: 0,
                  overtime_amount_total_eur: 0,
                };
                acc.hours_total += hoursRounded;
                acc.plus_10_12_total_eur += plusEur;
                acc.overtime_hours_total += otHours;
                acc.overtime_amount_total_eur += otAmount;
                breakdownByTech.set(tech, acc);
              });
          }
        }

        filteredQuotes = (payouts || []).map((p) => ({
          job_id: job.id,
          technician_id: p.technician_id!,
          start_time: job.start_time,
          end_time: job.end_time ?? job.start_time,
          job_type: job.job_type || 'single',
          tour_id: tourId,
          title: job.title,
          is_house_tech: false,
          is_tour_team_member: false,
          category: '',
          base_day_eur: Number(p.timesheets_total_eur ?? 0),
          week_count: 1,
          multiplier: 1,
          iso_year: null,
          iso_week: null,
          total_eur: Number(p.total_eur ?? 0),
          extras: undefined,
          extras_total_eur: Number(p.extras_total_eur ?? 0),
          total_with_extras_eur: Number(p.total_eur ?? 0),
          vehicle_disclaimer: p.vehicle_disclaimer ?? undefined,
          vehicle_disclaimer_text: p.vehicle_disclaimer_text ?? undefined,
          breakdown: {
            single_hours_total: breakdownByTech.get(p.technician_id!)?.hours_total ?? 0,
            single_plus_10_12_total_eur: breakdownByTech.get(p.technician_id!)?.plus_10_12_total_eur ?? 0,
            single_overtime_hours_total: breakdownByTech.get(p.technician_id!)?.overtime_hours_total ?? 0,
            single_overtime_amount_total_eur: breakdownByTech.get(p.technician_id!)?.overtime_amount_total_eur ?? 0,
          },
        } as TourJobRateQuote));
      }
    }

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
