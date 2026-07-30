import type { SupabaseClient } from '@supabase/supabase-js';
import type { TourJobRateQuote } from '@/types/tourRates';
import { buildTourPayoutPdfFilename } from '@/utils/pdfFileNames';
import type { TechnicianProfile, TimesheetLine } from '@/utils/rates-pdf-export';
import { generateRateQuotePDF } from '@/utils/rates-pdf-export';

export interface TourJobEmailJobDetails {
  id: string;
  title: string;
  start_time: string;
  tour_id?: string | null;
  job_type?: string | null;
  rates_approved?: boolean | null;
  invoicing_company?: string | null;
}

// Note: NON_AUTONOMO_DEDUCTION removed - server applies discount to base before multipliers

export interface TourJobEmailAttachment {
  technician_id: string;
  email?: string | null;
  full_name: string;
  quote: TourJobRateQuote;
  deduction_eur?: number;
  pdfBase64: string;
  filename: string;
  autonomo?: boolean | null;
  is_house_tech?: boolean | null;
  lpo_number?: string | null;
}


export interface TourJobEmailContextResult {
  job: TourJobEmailJobDetails;
  quotes: TourJobRateQuote[];
  profiles: (TechnicianProfile & { email?: string | null })[];
  lpoMap?: Map<string, string | null>;
  timesheetDateMap: Map<string, Set<string>>;
  prepTimesheetMap: Map<string, TimesheetLine[]>;
  hourlyTimesheetMap: Map<string, TimesheetLine[]>;
  expenseMap: Map<string, number>;
  attachments: TourJobEmailAttachment[];
  missingEmails: string[];
}

export interface TourJobEmailInput {
  jobId: string;
  supabase: SupabaseClient;
  quotes: TourJobRateQuote[];
  profiles: (TechnicianProfile & { email?: string | null })[];
}

interface TourEmailTimesheetRow {
  technician_id?: string | null;
  job_id?: string | null;
  date?: string | null;
  approved_by_manager?: boolean | null;
  amount_breakdown?: unknown;
  amount_breakdown_visible?: unknown;
}

// Backward-compatible no-op for stale dev/HMR imports. Multi-day rehearsal math
// is now computed server-side in compute_tour_job_rate_quote_2025.
export function adjustRehearsalQuotesForMultiDay(
  quotes: TourJobRateQuote[],
): TourJobRateQuote[] {
  return quotes;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function fetchJobDetails(
  client: SupabaseClient,
  jobId: string
): Promise<TourJobEmailJobDetails> {
  const { data, error } = await client
    .from('jobs')
    .select('id, title, start_time, tour_id, job_type, rates_approved, invoicing_company')
    .eq('id', jobId)
    .maybeSingle();
  if (error || !data) {
    throw error || new Error('Job not found');
  }
  return data as TourJobEmailJobDetails;
}

async function fetchLpoMap(
  client: SupabaseClient,
  jobId: string,
): Promise<Map<string, string | null>> {
  const { data, error } = await client
    .from('flex_work_orders')
    .select('technician_id, lpo_number')
    .eq('job_id', jobId);
  if (error) throw error;
  return new Map((data || []).map((row: any) => [row.technician_id, row.lpo_number || null]));
}

export async function fetchTourJobEmailTimesheets(
  client: SupabaseClient,
  jobId: string,
): Promise<TourEmailTimesheetRow[]> {
  const { data, error } = await client
    .from('timesheets')
    .select('technician_id, job_id, date, approved_by_manager, amount_breakdown')
    .eq('job_id', jobId)
    .eq('is_active', true);
  if (error) throw error;
  return data || [];
}

export async function fetchTourJobHourlyRateModes(
  client: SupabaseClient,
  jobId: string,
): Promise<Array<{ job_id: string; technician_id: string; date: string }>> {
  const { data, error } = await client.rpc('get_hourly_rate_mode_dates_for_timesheets', {
    _job_ids: [jobId],
  });
  if (error) throw error;
  return (data || []) as Array<{ job_id: string; technician_id: string; date: string }>;
}

function buildTimesheetLine(row: TourEmailTimesheetRow): TimesheetLine {
  const breakdown = (row.amount_breakdown || row.amount_breakdown_visible || {}) as Record<string, unknown>;
  return {
    date: row.date ?? null,
    hours_rounded: Number(breakdown.hours_rounded ?? breakdown.worked_hours_rounded ?? 0) || 0,
    base_day_eur: breakdown.base_day_eur != null ? Number(breakdown.base_day_eur) : undefined,
    plus_10_12_hours:
      breakdown.plus_10_12_hours != null ? Number(breakdown.plus_10_12_hours) : undefined,
    plus_10_12_amount_eur:
      breakdown.plus_10_12_amount_eur != null ? Number(breakdown.plus_10_12_amount_eur) : undefined,
    overtime_hours: breakdown.overtime_hours != null ? Number(breakdown.overtime_hours) : undefined,
    overtime_hour_eur:
      breakdown.overtime_hour_eur != null ? Number(breakdown.overtime_hour_eur) : undefined,
    overtime_amount_eur:
      breakdown.overtime_amount_eur != null ? Number(breakdown.overtime_amount_eur) : undefined,
    total_eur: breakdown.total_eur != null ? Number(breakdown.total_eur) : undefined,
    is_prep_day: breakdown.is_prep_day === true,
    is_seasonal_house_tech: breakdown.is_seasonal_house_tech === true,
    seasonal_overtime_only: breakdown.seasonal_overtime_only === true,
    prep_day_hourly_rate_eur:
      breakdown.prep_day_hourly_rate_eur != null ? Number(breakdown.prep_day_hourly_rate_eur) : undefined,
  };
}

export function buildPrepTimesheetMap(rows: TourEmailTimesheetRow[]): Map<string, TimesheetLine[]> {
  const map = new Map<string, TimesheetLine[]>();

  rows.forEach((row) => {
    if (!row.technician_id) return;
    if (row.approved_by_manager !== true) return;
    const breakdown = (row.amount_breakdown || row.amount_breakdown_visible || {}) as Record<string, unknown>;
    if (breakdown.is_prep_day !== true) return;

    const line: TimesheetLine = {
      ...buildTimesheetLine(row),
      plus_10_12_hours: 0,
      plus_10_12_amount_eur: 0,
      overtime_hours: 0,
      overtime_hour_eur: 0,
      overtime_amount_eur: 0,
      is_prep_day: true,
    };

    const existing = map.get(row.technician_id) || [];
    existing.push(line);
    map.set(row.technician_id, existing);
  });

  return map;
}

export function buildHourlyTimesheetMap(
  rows: TourEmailTimesheetRow[],
  hourlyRateModes: Array<{ technician_id: string; date: string }>,
  seasonalTechnicianIds: Set<string> = new Set(),
): Map<string, TimesheetLine[]> {
  const hourlyKeys = new Set(
    hourlyRateModes.map((row) => `${row.technician_id}:${row.date}`),
  );
  const map = new Map<string, TimesheetLine[]>();

  rows.forEach((row) => {
    if (!row.technician_id || !row.date) return;
    if (row.approved_by_manager !== true) return;
    if (!hourlyKeys.has(`${row.technician_id}:${row.date}`)
      && !seasonalTechnicianIds.has(row.technician_id)) return;

    const line = buildTimesheetLine(row);
    const existing = map.get(row.technician_id) || [];
    existing.push(line);
    map.set(row.technician_id, existing);
  });

  map.forEach((lines) => {
    lines.sort((left, right) => String(left.date ?? '').localeCompare(String(right.date ?? '')));
  });

  return map;
}

export function buildTourTimesheetDateMap(
  prepTimesheetMap: Map<string, TimesheetLine[]>,
  hourlyTimesheetMap: Map<string, TimesheetLine[]>,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  [prepTimesheetMap, hourlyTimesheetMap].forEach((sourceMap) => {
    sourceMap.forEach((lines, technicianId) => {
      const dates = lines
        .map((line) => line.date)
        .filter((date): date is string => Boolean(date));
      if (dates.length === 0) return;

      const existing = map.get(technicianId) || new Set<string>();
      dates.forEach((date) => existing.add(date));
      map.set(technicianId, existing);
    });
  });

  return map;
}

export function buildPrepTimesheetDateMap(
  prepTimesheetMap: Map<string, TimesheetLine[]>
): Map<string, Set<string>> {
  return buildTourTimesheetDateMap(prepTimesheetMap, new Map());
}

export async function prepareTourJobEmailContext(
  input: TourJobEmailInput
): Promise<TourJobEmailContextResult> {
  const { jobId, supabase, quotes, profiles } = input;
  const [job, lpoMap, timesheetRows, hourlyRateModes] = await Promise.all([
    fetchJobDetails(supabase, jobId),
    fetchLpoMap(supabase, jobId),
    fetchTourJobEmailTimesheets(supabase, jobId),
    fetchTourJobHourlyRateModes(supabase, jobId),
  ]);
  const prepTimesheetMap = buildPrepTimesheetMap(timesheetRows);
  const seasonalTechnicianIds = new Set(
    profiles
      .filter((profile) => profile.role === 'house_tech' && profile.seasonal_house_tech === true)
      .map((profile) => profile.id),
  );
  const hourlyTimesheetMap = buildHourlyTimesheetMap(
    timesheetRows,
    hourlyRateModes,
    seasonalTechnicianIds,
  );

  // Fetch expenses for tour date jobs
  const expenseMap = new Map<string, number>();
  try {
    const { data: expenseRows } = await supabase
      .from('v_job_expense_summary')
      .select('technician_id, approved_total_eur')
      .eq('job_id', jobId);
    (expenseRows || []).forEach((row: { technician_id: string | null; approved_total_eur: number | null }) => {
      if (!row.technician_id) return;
      const current = expenseMap.get(row.technician_id) || 0;
      expenseMap.set(row.technician_id, current + Number(row.approved_total_eur ?? 0));
    });
  } catch (e) {
    console.warn('[tour-payout-email] Failed to fetch expenses:', e);
  }

  const timesheetDateMap = buildTourTimesheetDateMap(prepTimesheetMap, hourlyTimesheetMap);

  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const attachments: TourJobEmailAttachment[] = [];

  // Generate one PDF per technician (filtered quote array per tech)
  const techIds = Array.from(new Set(quotes.map(q => q.technician_id)));
  for (const techId of techIds) {
    const techQuotes = quotes.filter(q => q.technician_id === techId);
    if (!techQuotes.length) continue;

    const profile = profileMap.get(techId);
    const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || techId;

    // For tour jobs, deduction is already applied server-side to base before multipliers
    // No client-side deduction calculation needed
    const deduction = 0;

    let blob: Blob | void;
    try {
      blob = (await generateRateQuotePDF(
        techQuotes,
        { id: job.id, title: job.title, start_time: job.start_time, end_time: undefined, tour_id: job.tour_id, job_type: job.job_type },
        profiles,
        lpoMap,
        {
          download: false,
          timesheetMap: timesheetDateMap,
          prepTimesheetMap,
          hourlyTimesheetMap,
        }
      )) as Blob | void;
    } catch (error) {
      console.error(`[tour-payout-email] Failed to generate PDF for technician ${techId}:`, error);
      continue;
    }

    if (!blob) {
      console.warn(`[tour-payout-email] PDF generation returned null/undefined for technician ${techId}`);
      continue;
    }

    const pdfBase64 = await blobToBase64(blob);
    const filename = buildTourPayoutPdfFilename({
      jobTitle: job.title,
      jobId: job.id,
      technicianName: fullName,
      technicianId: techId,
      generatedAt: new Date(),
    });

    attachments.push({
      technician_id: techId,
      email: (profile as any)?.email ?? null,
      full_name: fullName,
      quote: techQuotes[0],
      deduction_eur: deduction,
      pdfBase64,
      filename,
      autonomo: profile?.autonomo ?? null,
      is_house_tech: (profile as any)?.is_house_tech ?? null,
      lpo_number: lpoMap.get(techId) ?? null,
    });
  }

  const missingEmails = attachments
    .filter((attachment) => !attachment.email)
    .map((attachment) => attachment.technician_id);

  return {
    job,
    quotes,
    profiles,
    lpoMap,
    timesheetDateMap,
    prepTimesheetMap,
    hourlyTimesheetMap,
    expenseMap,
    attachments,
    missingEmails,
  };
}

export interface SendTourJobEmailsResult {
  success: boolean;
  missingEmails: string[];
  response?: any;
  error?: any;
  context: TourJobEmailContextResult;
}

export interface SendTourJobEmailsInput extends TourJobEmailInput {
  technicianIds?: string[]; // optional subset
}

export async function sendTourJobEmails(
  input: SendTourJobEmailsInput
): Promise<SendTourJobEmailsResult> {
  const context = await prepareTourJobEmailContext(input);
  const targetSet = new Set((input.technicianIds && input.technicianIds.length ? input.technicianIds : undefined) || context.attachments.map(a => a.technician_id));
  const recipients = context.attachments.filter((attachment) => attachment.email && targetSet.has(attachment.technician_id));

  if (!recipients.length) {
    return {
      success: false,
      missingEmails: context.missingEmails,
      context,
      error: new Error('No technicians with email available'),
    };
  }

  const payload = {
    job: {
      id: context.job.id,
      title: context.job.title,
      start_time: context.job.start_time,
      tour_id: context.job.tour_id ?? null,
      invoicing_company: context.job.invoicing_company ?? null,
    },
    technicians: recipients.map((attachment) => {
      const q = attachment.quote;
      const baseTotal = Number(q.total_eur ?? 0);
      const extrasTotal = Number(
        q.extras_total_eur ?? (q.extras?.total_eur != null ? q.extras.total_eur : 0)
      );
      const computedGrandTotal =
        q.total_with_extras_eur != null
          ? Number(q.total_with_extras_eur)
          : baseTotal + extrasTotal;

      // Manual payout override should be the source of truth for the amount communicated to the technician.
      const techExpenses = context.expenseMap.get(attachment.technician_id) ?? 0;
      const computedGrandTotalWithExpenses = computedGrandTotal + techExpenses;
      const prepLines = context.prepTimesheetMap.get(attachment.technician_id) || [];
      const prepTotal = prepLines.reduce((sum, line) => sum + Number(line.total_eur ?? 0), 0);
      const prepDates = Array.from(
        new Set(prepLines.map((line) => line.date).filter((date): date is string => date != null))
      ).sort();

      // Overrides replace the base+extras portion; expenses are always added on top
      // since they are reimbursements, not part of the negotiated rate. Prep days are
      // approved fixed-rate timesheets and are added on top of the tour quote.
      const grandTotal =
        q.has_override && q.override_amount_eur != null
          ? Number(q.override_amount_eur) + prepTotal + techExpenses
          : computedGrandTotalWithExpenses + prepTotal;
      const deduction = attachment.deduction_eur || 0;

      // Extract unique worked dates from timesheets
      const dateSet = context.timesheetDateMap.get(attachment.technician_id) || new Set<string>();
      const workedDates = Array.from(dateSet).sort();

      return {
        technician_id: attachment.technician_id,
        email: attachment.email,
        full_name: attachment.full_name,
        totals: {
          timesheets_total_eur: baseTotal + prepTotal, // tour quote base plus approved prep-day timesheets
          extras_total_eur: extrasTotal,
          expenses_total_eur: techExpenses,
          total_eur: grandTotal - deduction,
          deduction_eur: deduction,
        },
        pdf_base64: attachment.pdfBase64,
        filename: attachment.filename,
        autonomo: attachment.autonomo ?? null,
        is_house_tech: attachment.is_house_tech ?? null,
        lpo_number: attachment.lpo_number ?? null,
        worked_dates: workedDates,
        prep_dates: prepDates,
      };
    }),
    missing_emails: context.missingEmails,
    requested_at: new Date().toISOString(),
  };

  const { data, error } = await input.supabase.functions.invoke('send-job-payout-email', {
    body: payload,
  });

  return {
    success: !error && data?.success !== false,
    missingEmails: context.missingEmails,
    response: data,
    error,
    context,
  };
}
