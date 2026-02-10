import { format } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { JobPayoutTotals } from '@/types/jobExtras';
import { generateJobPayoutPDF, TimesheetLine } from '@/utils/rates-pdf-export';

export interface TechnicianProfileWithEmail {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  autonomo?: boolean | null;
  is_house_tech?: boolean | null;
}

export interface JobPayoutEmailJobDetails {
  id: string;
  title: string;
  start_time: string;
  tour_id?: string | null;
  rates_approved?: boolean | null;
  invoicing_company?: string | null;
}

// ...
const NON_AUTONOMO_DEDUCTION_EUR = 30;

export interface JobPayoutEmailAttachment {
  technician_id: string;
  email?: string | null;
  full_name: string;
  payout: JobPayoutTotals;
  deduction_eur?: number;
  pdfBase64: string;
  filename: string;
  autonomo?: boolean | null;
  is_house_tech?: boolean | null;
  lpo_number?: string | null;
}

export interface JobPayoutEmailContextResult {
  job: JobPayoutEmailJobDetails;
  payouts: JobPayoutTotals[];
  profiles: TechnicianProfileWithEmail[];
  lpoMap?: Map<string, string | null>;
  timesheetMap: Map<string, TimesheetLine[]>;
  attachments: JobPayoutEmailAttachment[];
  missingEmails: string[];
}

export interface JobPayoutEmailInput {
  jobId: string;
  supabase: SupabaseClient;
  payouts?: JobPayoutTotals[];
  profiles?: TechnicianProfileWithEmail[];
  lpoMap?: Map<string, string | null>;
  jobDetails?: JobPayoutEmailJobDetails | null;
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

function buildTimesheetMap(rows: any[]): Map<string, TimesheetLine[]> {
  const map = new Map<string, TimesheetLine[]>();
  rows.forEach((row) => {
    const breakdown = (row.amount_breakdown || row.amount_breakdown_visible || {}) as Record<string, any>;
    const line: TimesheetLine = {
      date: row.date ?? null,
      hours_rounded: Number(breakdown.hours_rounded ?? breakdown.worked_hours_rounded ?? 0) || 0,
      base_day_eur: breakdown.base_day_eur != null ? Number(breakdown.base_day_eur) : undefined,
      plus_10_12_hours: breakdown.plus_10_12_hours != null ? Number(breakdown.plus_10_12_hours) : undefined,
      plus_10_12_amount_eur:
        breakdown.plus_10_12_amount_eur != null ? Number(breakdown.plus_10_12_amount_eur) : undefined,
      overtime_hours: breakdown.overtime_hours != null ? Number(breakdown.overtime_hours) : undefined,
      overtime_hour_eur: breakdown.overtime_hour_eur != null ? Number(breakdown.overtime_hour_eur) : undefined,
      overtime_amount_eur:
        breakdown.overtime_amount_eur != null ? Number(breakdown.overtime_amount_eur) : undefined,
      total_eur: breakdown.total_eur != null ? Number(breakdown.total_eur) : undefined,
      is_evento: breakdown.is_evento === true,
    };

    const existing = map.get(row.technician_id) || [];
    existing.push(line);
    map.set(row.technician_id, existing);
  });
  return map;
}

async function fetchJobDetails(
  client: SupabaseClient,
  jobId: string,
  provided?: JobPayoutEmailJobDetails | null
): Promise<JobPayoutEmailJobDetails> {
  if (provided) return provided;
  const { data, error } = await client
    .from('jobs')
    .select('id, title, start_time, tour_id, rates_approved, invoicing_company')
    .eq('id', jobId)
    .maybeSingle();
  if (error || !data) {
    throw error || new Error('Job not found');
  }
  return data as JobPayoutEmailJobDetails;
}

async function fetchPayouts(
  client: SupabaseClient,
  jobId: string,
  provided?: JobPayoutTotals[]
): Promise<JobPayoutTotals[]> {
  if (provided && provided.length) return provided;
  const { data, error } = await client
    .from('v_job_tech_payout_2025')
    .select('*')
    .eq('job_id', jobId);
  if (error) throw error;
  return (data || []) as JobPayoutTotals[];
}

/**
 * Enrich payouts with override metadata (who/when + override amount).
 *
 * Notes:
 * - `v_job_tech_payout_2025` already applies the override to `total_eur`, but does not expose audit fields.
 * - We pull `v_job_tech_payout_2025_base.total_eur` as the "calculated" baseline for context.
 */
async function attachOverrideMetadata(
  client: SupabaseClient,
  jobId: string,
  payouts: JobPayoutTotals[]
): Promise<JobPayoutTotals[]> {
  const techIds = Array.from(new Set(payouts.map((p) => p.technician_id).filter(Boolean)));
  if (!jobId || techIds.length === 0) return payouts;

  const [{ data: overrides, error: oErr }, { data: baseRows, error: bErr }] = await Promise.all([
    client
      .from('job_technician_payout_overrides')
      .select('technician_id, override_amount_eur, set_by, set_at, updated_at')
      .eq('job_id', jobId)
      .in('technician_id', techIds),
    client
      .from('v_job_tech_payout_2025_base')
      .select('technician_id, total_eur')
      .eq('job_id', jobId)
      .in('technician_id', techIds),
  ]);

  if (oErr) throw oErr;
  if (bErr) throw bErr;

  const baseTotalMap = new Map<string, number>();
  (baseRows || []).forEach((r: any) => {
    if (!r?.technician_id) return;
    baseTotalMap.set(r.technician_id, Number(r.total_eur ?? 0));
  });

  const overrideByTech = new Map<string, any>();
  const actorIds = new Set<string>();
  (overrides || []).forEach((row: any) => {
    if (!row?.technician_id) return;
    overrideByTech.set(row.technician_id, row);
    if (row.set_by) actorIds.add(row.set_by);
  });

  let actorMap = new Map<string, { name: string; email: string | null }>();
  if (actorIds.size > 0) {
    const { data: actors, error: aErr } = await client
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', Array.from(actorIds));
    if (aErr) throw aErr;
    actorMap = new Map(
      (actors || []).map((a: any) => [
        a.id,
        {
          name: `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.id,
          email: a.email ?? null,
        },
      ])
    );
  }

  return payouts.map((p) => {
    const ov = overrideByTech.get(p.technician_id);
    if (!ov) return p;

    const actor = ov.set_by ? actorMap.get(ov.set_by) : null;
    const calculated = baseTotalMap.get(p.technician_id);

    return {
      ...p,
      has_override: true,
      override_amount_eur: Number(ov.override_amount_eur),
      calculated_total_eur: calculated != null ? calculated : undefined,
      override_set_at: ov.set_at,
      override_actor_name: actor?.name,
      override_actor_email: actor?.email ?? undefined,
    };
  });
}

async function fetchProfiles(
  client: SupabaseClient,
  techIds: string[],
  provided?: TechnicianProfileWithEmail[]
): Promise<TechnicianProfileWithEmail[]> {
  if (provided) {
    const hasEmailField = provided.every((p) => Object.prototype.hasOwnProperty.call(p, 'email'));
    const hasAutonomoField = provided.every((p) => Object.prototype.hasOwnProperty.call(p, 'autonomo'));
    const hasHouseTechField = provided.every((p) => Object.prototype.hasOwnProperty.call(p, 'is_house_tech'));
    if (hasEmailField && hasAutonomoField && hasHouseTechField) {
      return provided;
    }
  }
  if (!techIds.length) return provided || [];

  // Fetch basic profile data (is_house_tech is a function, not a column)
  const { data, error } = await client
    .from('profiles')
    .select('id, first_name, last_name, email, autonomo')
    .in('id', techIds);
  if (error) throw error;

  // Fetch house tech status for each profile using the RPC function
  const profiles = (data || []) as TechnicianProfileWithEmail[];
  for (const profile of profiles) {
    try {
      const { data: isHouseTech } = await client.rpc('is_house_tech', { _profile_id: profile.id });
      profile.is_house_tech = isHouseTech ?? false;
    } catch {
      profile.is_house_tech = false;
    }
  }

  return profiles;
}

async function fetchLpoMap(
  client: SupabaseClient,
  jobId: string,
  technicianIds: string[],
  provided?: Map<string, string | null>
): Promise<Map<string, string | null>> {
  if (provided) return provided;
  if (!technicianIds.length) return new Map();
  const { data, error } = await client
    .from('flex_work_orders')
    .select('technician_id, lpo_number')
    .eq('job_id', jobId)
    .in('technician_id', technicianIds);
  if (error) throw error;
  return new Map((data || []).map((row: any) => [row.technician_id, row.lpo_number || null]));
}

async function fetchTimesheets(client: SupabaseClient, jobId: string): Promise<any[]> {
  const { data, error } = await client
    .from('timesheets')
    .select('technician_id, job_id, date, amount_breakdown, approved_by_manager')
    .eq('job_id', jobId)
    .eq('approved_by_manager', true);
  if (error) throw error;
  if (data && data.length) return data as any[];
  const { data: rpcData, error: rpcError } = await client.rpc('get_timesheet_amounts_visible');
  if (rpcError) throw rpcError;
  return ((rpcData as any[]) || []).filter(
    (row) => row.job_id === jobId && row.approved_by_manager === true
  );
}

export async function prepareJobPayoutEmailContext(
  input: JobPayoutEmailInput
): Promise<JobPayoutEmailContextResult> {
  const { jobId, supabase, jobDetails: providedJob, payouts: providedPayouts, profiles: providedProfiles, lpoMap: providedLpoMap } =
    input;
  const job = await fetchJobDetails(supabase, jobId, providedJob);
  const payoutsRaw = await fetchPayouts(supabase, jobId, providedPayouts);
  const payouts = await attachOverrideMetadata(supabase, jobId, payoutsRaw);
  const technicianIds = Array.from(new Set(payouts.map((p) => p.technician_id).filter(Boolean)));
  const profiles = await fetchProfiles(supabase, technicianIds, providedProfiles);
  const lpoMap = await fetchLpoMap(supabase, jobId, technicianIds, providedLpoMap);
  const timesheetRows = await fetchTimesheets(supabase, jobId);
  const timesheetMap = buildTimesheetMap(timesheetRows);

  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const attachments: JobPayoutEmailAttachment[] = [];
  for (const payout of payouts) {
    const profile = profileMap.get(payout.technician_id);
    const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || payout.technician_id;
    const perTechMap = new Map<string, TimesheetLine[]>([
      [payout.technician_id, timesheetMap.get(payout.technician_id) || []],
    ]);
    
    // Calculate deduction - only for non-autonomo contracted workers (not house techs)
    let deduction = 0;
    const isNonAutonomoContracted = profile?.autonomo === false && profile?.is_house_tech !== true;
    if (isNonAutonomoContracted) {
        let daysCount = 0;
        const lines = timesheetMap.get(payout.technician_id) || [];
        if (lines.length > 0) {
            const uniqueDates = new Set(lines.map(l => l.date).filter(Boolean));
            daysCount = uniqueDates.size > 0 ? uniqueDates.size : 1;
        } else if (payout.timesheets_total_eur > 0) {
            daysCount = 1;
        }
        deduction = daysCount * NON_AUTONOMO_DEDUCTION_EUR;
    }

    let blob: Blob | void;
    try {
      blob = (await generateJobPayoutPDF(
        [payout],
        job,
        profiles,
        lpoMap,
        perTechMap,
        { download: false }
      )) as Blob | void;
    } catch (error) {
      console.error(`[job-payout-email] Failed to generate PDF for technician ${payout.technician_id}:`, error);
      continue;
    }

    if (!blob) {
      console.warn(`[job-payout-email] PDF generation returned null/undefined for technician ${payout.technician_id}`);
      continue;
    }
    const pdfBase64 = await blobToBase64(blob);
    const jobSlug = sanitizeForFilename(job.title || job.id);
    const techSlug = sanitizeForFilename(fullName);
    const datePart = format(new Date(), 'yyyy-MM-dd');
    const filename = `pago_${jobSlug || job.id}_${techSlug || payout.technician_id}_${datePart}.pdf`;
    attachments.push({
      technician_id: payout.technician_id,
      email: profile?.email ?? null,
      full_name: fullName,
      payout,
      deduction_eur: deduction,
      pdfBase64,
      filename,
      autonomo: profile?.autonomo ?? null,
      is_house_tech: profile?.is_house_tech ?? null,
      lpo_number: lpoMap.get(payout.technician_id) ?? null,
    });
  }

  const missingEmails = attachments
    .filter((attachment) => !attachment.email)
    .map((attachment) => attachment.technician_id);

  return {
    job,
    payouts,
    profiles,
    lpoMap,
    timesheetMap,
    attachments,
    missingEmails,
  };
}

export interface SendJobPayoutEmailsResult {
  success: boolean;
  missingEmails: string[];
  response?: any;
  error?: any;
  context: JobPayoutEmailContextResult;
}

export interface SendJobPayoutEmailsInput extends JobPayoutEmailInput {
  existingContext?: JobPayoutEmailContextResult;
}

/**
 * Compute the total that should be shown in payout emails.
 *
 * If there's a manual override, prefer `override_amount_eur` over `total_eur`.
 * (Some sources already bake the override into `total_eur`, but we treat the
 * override value as the explicit source of truth for email display.)
 */
export function effectiveTotal(payout: JobPayoutTotals, deduction = 0): number {
  const base =
    payout.has_override && payout.override_amount_eur != null
      ? Number(payout.override_amount_eur)
      : Number(payout.total_eur ?? 0);
  return base - Number(deduction || 0);
}

export async function sendJobPayoutEmails(
  input: SendJobPayoutEmailsInput
): Promise<SendJobPayoutEmailsResult> {
  const context =
    input.existingContext ?? (await prepareJobPayoutEmailContext(input));
  const recipients = context.attachments.filter((attachment) => attachment.email);

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
      // Extract unique worked dates from timesheets
      const timesheetLines = context.timesheetMap.get(attachment.technician_id) || [];
      const workedDates = Array.from(
        new Set(
          timesheetLines
            .map((line) => line.date)
            .filter((date): date is string => date != null)
        )
      ).sort();
      // Check if any timesheet is an evento type
      const hasEventoTimesheet = timesheetLines.some((line) => line.is_evento === true);

      return {
        technician_id: attachment.technician_id,
        email: attachment.email,
        full_name: attachment.full_name,
        totals: {
          timesheets_total_eur: attachment.payout.timesheets_total_eur,
          extras_total_eur: attachment.payout.extras_total_eur,
          total_eur: effectiveTotal(attachment.payout, attachment.deduction_eur || 0),
          deduction_eur: attachment.deduction_eur,
        },
        pdf_base64: attachment.pdfBase64,
        filename: attachment.filename,
        autonomo: attachment.autonomo ?? null,
        is_house_tech: attachment.is_house_tech ?? null,
        lpo_number: attachment.lpo_number ?? null,
        worked_dates: workedDates,
        is_evento: hasEventoTimesheet,
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
