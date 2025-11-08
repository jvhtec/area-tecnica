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
}

export interface TourJobEmailAttachment {
  technician_id: string;
  email?: string | null;
  full_name: string;
  quote: TourJobRateQuote;
  pdfBase64: string;
  filename: string;
  autonomo?: boolean | null;
}

export interface TourJobEmailContextResult {
  job: TourJobEmailJobDetails;
  quotes: TourJobRateQuote[];
  profiles: (TechnicianProfile & { email?: string | null })[];
  lpoMap?: Map<string, string | null>;
  attachments: TourJobEmailAttachment[];
  missingEmails: string[];
}

export interface TourJobEmailInput {
  jobId: string;
  supabase: SupabaseClient;
  quotes: TourJobRateQuote[];
  profiles: (TechnicianProfile & { email?: string | null })[];
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
    .select('id, title, start_time, tour_id, job_type, rates_approved')
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

export async function prepareTourJobEmailContext(
  input: TourJobEmailInput
): Promise<TourJobEmailContextResult> {
  const { jobId, supabase, quotes, profiles } = input;
  const job = await fetchJobDetails(supabase, jobId);
  const lpoMap = await fetchLpoMap(supabase, jobId);

  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const attachments: TourJobEmailAttachment[] = [];

  // Generate one PDF per technician (filtered quote array per tech)
  const techIds = Array.from(new Set(quotes.map(q => q.technician_id)));
  for (const techId of techIds) {
    const techQuotes = quotes.filter(q => q.technician_id === techId);
    if (!techQuotes.length) continue;

    const profile = profileMap.get(techId);
    const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || techId;

    const blob = (await generateRateQuotePDF(
      techQuotes,
      { id: job.id, title: job.title, start_time: job.start_time, end_time: undefined, tour_id: job.tour_id, job_type: job.job_type },
      profiles,
      lpoMap,
      { download: false }
    )) as Blob | void;
    if (!blob) continue;

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
      pdfBase64,
      filename,
      autonomo: profile?.autonomo ?? null,
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
    },
    technicians: recipients.map((attachment) => {
      const q = attachment.quote;
      const baseTotal = Number(q.total_eur || 0);
      const extrasTotal = Number(q.extras_total_eur || 0);
      const grandTotal = Number(q.total_with_extras_eur != null ? q.total_with_extras_eur : baseTotal + extrasTotal);
      return {
        technician_id: attachment.technician_id,
        email: attachment.email,
        full_name: attachment.full_name,
        totals: {
          timesheets_total_eur: baseTotal, // base portion for tour rates
          extras_total_eur: extrasTotal,
          total_eur: grandTotal,
        },
        pdf_base64: attachment.pdfBase64,
        filename: attachment.filename,
        autonomo: attachment.autonomo ?? null,
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

