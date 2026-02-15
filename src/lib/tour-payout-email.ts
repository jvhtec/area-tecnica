import { format } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TourJobRateQuote } from '@/types/tourRates';
import type { TechnicianProfile } from '@/utils/rates-pdf-export';
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

/**
 * For rehearsal-category quotes the RPC returns a per-day flat rate.
 * This helper multiplies the relevant totals by the number of scheduled
 * timesheet days so that PDFs and emails show the correct multi-day amount.
 */
export function adjustRehearsalQuotesForMultiDay(
  quotes: TourJobRateQuote[],
  daysCounts: Map<string, number>
): TourJobRateQuote[] {
  return quotes.map(quote => {
    if (quote.category !== 'rehearsal') return quote;

    const days = daysCounts.get(quote.technician_id) || 1;
    if (days <= 1) return quote;

    const adjustedBaseDayEur = Number(quote.base_day_eur ?? 0) * days;
    const adjustedTotalEur = Number(quote.total_eur ?? 0) * days;
    const extrasTotal = Number(
      quote.extras_total_eur ?? (quote.extras?.total_eur != null ? quote.extras.total_eur : 0)
    );

    return {
      ...quote,
      base_day_eur: adjustedBaseDayEur,
      total_eur: adjustedTotalEur,
      total_with_extras_eur: adjustedTotalEur + extrasTotal,
      calculated_total_eur:
        quote.calculated_total_eur != null ? Number(quote.calculated_total_eur) * days : quote.calculated_total_eur,
      breakdown: {
        ...quote.breakdown,
        ...(quote.breakdown?.after_discount != null
          ? { after_discount: Number(quote.breakdown.after_discount) * days }
          : {}),
        ...(quote.breakdown?.base_calculation != null
          ? { base_calculation: Number(quote.breakdown.base_calculation) * days }
          : {}),
        rehearsal_days: days,
      },
    };
  });
}

function sanitizeForFilename(value: string) {
  return value
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
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

async function fetchTimesheets(client: SupabaseClient, jobId: string): Promise<any[]> {
  const { data, error } = await client
    .from('timesheets')
    .select('technician_id, date, approved_by_manager')
    .eq('job_id', jobId)
    .eq('is_active', true);
  if (error) throw error;
  return data || [];
}

export async function prepareTourJobEmailContext(
  input: TourJobEmailInput
): Promise<TourJobEmailContextResult> {
  const { jobId, supabase, quotes, profiles } = input;
  const job = await fetchJobDetails(supabase, jobId);
  const lpoMap = await fetchLpoMap(supabase, jobId);
  const timesheetRows = await fetchTimesheets(supabase, jobId);

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

  // Build Timesheet Date Set Map
  const timesheetDateMap = new Map<string, Set<string>>();
  timesheetRows.forEach(row => {
      if (!row.technician_id || !row.date) return;
      if (!timesheetDateMap.has(row.technician_id)) timesheetDateMap.set(row.technician_id, new Set());
      timesheetDateMap.get(row.technician_id)!.add(row.date);
  });

  // Adjust rehearsal quotes for multi-day (RPC returns per-day flat rate)
  const daysCounts = new Map<string, number>();
  timesheetDateMap.forEach((dates, techId) => daysCounts.set(techId, dates.size));
  const adjustedQuotes = adjustRehearsalQuotesForMultiDay(quotes, daysCounts);

  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const attachments: TourJobEmailAttachment[] = [];

  // Generate one PDF per technician (filtered quote array per tech)
  const techIds = Array.from(new Set(adjustedQuotes.map(q => q.technician_id)));
  for (const techId of techIds) {
    const techQuotes = adjustedQuotes.filter(q => q.technician_id === techId);
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
            timesheetMap: timesheetDateMap
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
    const jobSlug = sanitizeForFilename(job.title || job.id);
    const techSlug = sanitizeForFilename(fullName);
    const datePart = format(new Date(), 'yyyy-MM-dd');
    const filename = `pago_${jobSlug || job.id}_${techSlug || techId}_${datePart}.pdf`;

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
    quotes: adjustedQuotes,
    profiles,
    lpoMap,
    timesheetDateMap,
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

      // Overrides replace the base+extras portion; expenses are always added on top
      // since they are reimbursements, not part of the negotiated rate.
      const grandTotal =
        q.has_override && q.override_amount_eur != null
          ? Number(q.override_amount_eur) + techExpenses
          : computedGrandTotalWithExpenses;
      const deduction = attachment.deduction_eur || 0;

      // Extract unique worked dates from timesheets
      const dateSet = context.timesheetDateMap.get(attachment.technician_id) || new Set<string>();
      const workedDates = Array.from(dateSet).sort();

      return {
        technician_id: attachment.technician_id,
        email: attachment.email,
        full_name: attachment.full_name,
        totals: {
          timesheets_total_eur: baseTotal, // base portion for tour rates
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
