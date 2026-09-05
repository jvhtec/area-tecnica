import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildLegacyStaffingActionUrl,
  buildPathStaffingActionUrl,
  buildWhatsAppStaffingMessage,
  normalizeStaffingConfirmBase,
} from "./messageUtils.ts";
import { sendBrevoEmail } from "../_shared/brevo.ts";
import { isServiceRoleRequest, requireAdminOrManagement } from "../_shared/auth.ts";
import { joinedSingle } from "../_shared/joins.ts";
import { escapeHtml } from "../_shared/corporateEmailTemplate.ts";
import { logEvent } from "../_shared/structuredLogger.ts";
import {
  corsHeaders,
  createHttpHandler,
  HttpError,
  readBoundedJsonObject,
} from "../_shared/http.ts";

// Inlined from roles.ts for dashboard deployment compatibility
const CODE_TO_LABEL: Record<string, string> = {
  // Sound
  'SND-FOH-R': 'FOH — Responsable',
  'SND-MON-R': 'Monitores — Responsable',
  'SND-SYS-R': 'Sistemas — Responsable',
  'SND-FOH-E': 'FOH — Especialista',
  'SND-MON-E': 'Monitores — Especialista',
  'SND-RF-E':  'RF — Especialista',
  'SND-SYS-E': 'Sistemas — Especialista',
  'SND-PA-T':  'Tecnico de Escenario — Técnico',
  'SND-MNT-T': 'Montador — Técnico',
  // Lights
  'LGT-BRD-R': 'Mesa — Responsable',
  'LGT-SYS-R': 'Sistema/Rig — Responsable',
  'LGT-BRD-E': 'Mesa — Especialista',
  'LGT-SYS-E': 'Sistema/Rig — Especialista',
  'LGT-FOLO-E': 'Follow Spot — Especialista',
  'LGT-PA-T':  'PA — Técnico',
  'LGT-ASST-R': 'Asistente — Responsable',
  'LGT-ASST-E': 'Asistente — Especialista',
  'LGT-DIM-R': 'Dimmer — Responsable',
  'LGT-DIM-E': 'Dimmer — Especialista',
  'LGT-CAN-T': 'Cañón — Técnico',
  'LGT-MON-T': 'Montador — Técnico',
  // Video
  'VID-SW-R':  'Switcher/TD — Responsable',
  'VID-DIR-E': 'Director — Especialista',
  'VID-CAM-E': 'Cámara — Especialista',
  'VID-LED-E': 'LED — Especialista',
  'VID-PROJ-E': 'Proyección — Especialista',
  'VID-PA-T':  'PA — Técnico',
  // Production
  'PROD-RESP-R': 'Responsable de Producción — Responsable',
  'PROD-AYUD-T': 'Ayudante de Producción — Técnico',
  'PROD-COND-T': 'Conductor — Técnico',
}

function labelForRoleCode(value?: string | null): string | null {
  if (!value) return null
  return CODE_TO_LABEL[value] ?? value
}

function dateOnly(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
}

function datesBetween(start?: string | null, end?: string | null): string[] {
  const startDate = dateOnly(start);
  const endDate = dateOnly(end);
  if (!startDate || !endDate) return [];

  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const last = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().split('T')[0]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function rangesOverlapInclusive(
  leftStart?: string | null,
  leftEnd?: string | null,
  rightStart?: string | null,
  rightEnd?: string | null
): boolean {
  if (!leftStart || !leftEnd || !rightStart || !rightEnd) return false;
  const aStart = new Date(leftStart).getTime();
  const aEnd = new Date(leftEnd).getTime();
  const bStart = new Date(rightStart).getTime();
  const bEnd = new Date(rightEnd).getTime();
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return false;
  return aStart <= bEnd && aEnd >= bStart;
}

function addDaysToDateKey(dateKey: string | null | undefined, days: number): string | null {
  if (!dateKey) return null;
  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().split('T')[0];
}

function dateKeyInRange(dateKey: string | null, start?: string | null, end?: string | null): boolean {
  if (!dateKey) return false;
  const startKey = dateOnly(start);
  const endKey = dateOnly(end);
  if (!startKey || !endKey) return false;
  const first = startKey <= endKey ? startKey : endKey;
  const last = startKey <= endKey ? endKey : startKey;
  return dateKey >= first && dateKey <= last;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

type StaffingJoinedJob = {
  id?: string | null;
  title?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

type StaffingRequestDateScope = {
  id?: string | null;
  job_id?: string | null;
  phase?: string | null;
  status?: string | null;
  role_code?: string | null;
  target_date?: string | null;
  single_day?: boolean | null;
  updated_at?: string | null;
  jobs?: StaffingJoinedJob | StaffingJoinedJob[] | null;
  job?: StaffingJoinedJob | null;
};

type StaffingEventRoleRow = {
  staffing_request_id?: string | null;
  meta?: { phase?: unknown; role?: unknown } | null;
};

function staffingRolePrefix(roleCode?: string | null): string | null {
  const normalized = typeof roleCode === 'string' ? roleCode.trim() : '';
  if (!normalized) return null;
  return normalized.replace(/-[RET]$/i, '') || null;
}

function staffingRequestOverlapsTargetDates(request: StaffingRequestDateScope, targetDates: string[]): boolean {
  const normalizedTargetDates = targetDates
    .map((date) => dateOnly(date))
    .filter((date): date is string => Boolean(date));
  if (normalizedTargetDates.length === 0) return true;

  const requestTargetDate = dateOnly(request?.target_date);
  if (request?.single_day === true && requestTargetDate) {
    return normalizedTargetDates.includes(requestTargetDate);
  }

  const job = joinedSingle(request?.jobs ?? request?.job);
  const jobStart = dateOnly(job?.start_time);
  const jobEnd = dateOnly(job?.end_time);
  if (jobStart && jobEnd) {
    const first = jobStart <= jobEnd ? jobStart : jobEnd;
    const last = jobStart <= jobEnd ? jobEnd : jobStart;
    return normalizedTargetDates.some((date) => date >= first && date <= last);
  }

  if (requestTargetDate) {
    return normalizedTargetDates.includes(requestTargetDate);
  }

  return true;
}

function distanceKm(
  lat1: number | null,
  lon1: number | null,
  lat2: number | null,
  lon2: number | null
): number | null {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
  const toRad = (value: number) => value * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function jobLocation(job: any): { latitude: number | null; longitude: number | null } {
  const location = joinedSingle(job?.locations);
  return {
    latitude: toFiniteNumber(location?.latitude),
    longitude: toFiniteNumber(location?.longitude),
  };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_SECRET = Deno.env.get("STAFFING_TOKEN_SECRET")!;
// Compute confirmation base URL using the functions domain so GET is allowed.
// WhatsApp uses a branded path when PUBLIC_STAFFING_CONFIRM_BASE is configured.
const __RAW_CONFIRM_BASE = Deno.env.get("PUBLIC_STAFFING_CONFIRM_BASE");
const __PROJECT_REF = (() => {
  try { return new URL(SUPABASE_URL).host.split('.')[0]; } catch { return ''; }
})();
const __FUNCTIONS_HOST = __PROJECT_REF ? `https://${__PROJECT_REF}.functions.supabase.co` : '';
const __DEFAULT_CONFIRM_BASE = __FUNCTIONS_HOST ? `${__FUNCTIONS_HOST}/staffing-click` : `${SUPABASE_URL}/functions/v1/staffing-click`;
const STAFFING_CONFIRM_BASE = __RAW_CONFIRM_BASE
  ? normalizeStaffingConfirmBase(__RAW_CONFIRM_BASE)
  : __DEFAULT_CONFIRM_BASE;
const BREVO_KEY = Deno.env.get("BREVO_API_KEY")!;
const BREVO_FROM = Deno.env.get("BREVO_FROM")!;
// Optional branding
// Defaults use Supabase Storage for reliability in email clients
const COMPANY_LOGO_URL = Deno.env.get("COMPANY_LOGO_URL_W") || `${SUPABASE_URL}/storage/v1/object/public/company-assets/sectorlogow.png`;
const AT_LOGO_URL = Deno.env.get("AT_LOGO_URL") || `${SUPABASE_URL}/storage/v1/object/public/company-assets/area-tecnica-logo.png`;
const DAILY_CAP = parseInt(Deno.env.get("STAFFING_DAILY_CAP") ?? "100", 10);
// Company-local timezone for end-user display (email/WhatsApp)
const COMPANY_TZ = Deno.env.get('COMPANY_TZ') || 'Europe/Madrid';
const STAFFING_SYSTEM_ACTOR_ID = Deno.env.get('STAFFING_SYSTEM_ACTOR_ID') || null;

function b64url(u8: Uint8Array) {
  return btoa(String.fromCharCode(...u8)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type StaffingPushChannel = 'email' | 'whatsapp';

function emitStaffingPush(params: {
  channel: StaffingPushChannel;
  jobId: string;
  profileId: string;
  actorId: string | null;
  department: string | null;
  staffingRequestId: string;
  phase: string;
  roleCode: string | null;
  targetDate: string | null;
  singleDay: boolean;
  requestOrigin: unknown;
  campaignId: unknown;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2_000);
  const eventType = params.phase === 'availability'
    ? 'staffing.availability.sent'
    : 'staffing.offer.sent';

  const pushPromise = fetch(`${SUPABASE_URL}/functions/v1/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
    },
    signal: controller.signal,
    body: JSON.stringify({
      action: 'broadcast',
      type: eventType,
      job_id: params.jobId,
      actor_id: params.actorId,
      recipient_id: params.profileId,
      department: params.department,
      channel: params.channel,
      target_date: params.targetDate,
      single_day: params.singleDay,
      staffing_request_id: params.staffingRequestId,
      role_code: params.roleCode,
      request_origin: params.requestOrigin ?? null,
      campaign_id: params.campaignId ?? null,
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        logEvent('warn', 'staffing_email.push_broadcast_returned_non_ok', { status: response.status });
      }
    })
    .catch((pushError) => {
      const timedOut = controller.signal.aborted;
      logEvent('warn', 'staffing_email.failed_to_emit_push');
    })
    .finally(() => clearTimeout(timeoutId));

  if (typeof EdgeRuntime !== 'undefined' && 'waitUntil' in EdgeRuntime) {
    EdgeRuntime.waitUntil(pushPromise);
  } else {
    void pushPromise;
  }
}

serve(createHttpHandler(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await readBoundedJsonObject<Record<string, any>>(req, { maxBytes: 128 * 1024 });
    const serviceRequest = isServiceRoleRequest(req, SERVICE_ROLE);
    let actorId: string | null = null;

    if (serviceRequest && typeof body?.actor_id === 'string') {
      actorId = body.actor_id;
    }

    if (!serviceRequest) {
      actorId = (await requireAdminOrManagement(supabase, req, {
        logContext: "send-staffing-email",
      })).userId;
    }

    if (!actorId && serviceRequest && isUuid(STAFFING_SYSTEM_ACTOR_ID)) {
      actorId = STAFFING_SYSTEM_ACTOR_ID;
    }
    logEvent('info', 'staffing_email.received_staffing_request');

    const { job_id, profile_id, phase, role, message, channel, tour_pdf_path, target_date, single_day, override_conflicts, require_no_conflicts, idempotency_key, request_origin, campaign_id, department } = body;
    const roleCode = typeof role === 'string' && role.trim().length > 0 ? role.trim() : null;
    const departmentHint = typeof department === 'string' && department.trim().length > 0 ? department.trim() : null;
    const roleCodePatch = roleCode && phase === 'offer' ? { role_code: roleCode } : {};
    const datesArrayRaw: unknown = (body as any)?.dates;
    const shouldOverrideConflicts = Boolean(override_conflicts);
    const shouldRequireNoConflicts = Boolean(require_no_conflicts);
    const desiredChannel = (typeof channel === 'string' && channel.toLowerCase() === 'whatsapp') ? 'whatsapp' : 'email';
    const rawTargetDate = typeof target_date === 'string' && target_date ? target_date : null;
    let normalizedTargetDate = rawTargetDate ? (() => {
      const parsed = new Date(rawTargetDate);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed.toISOString().split('T')[0];
    })() : null;
    const normalizedDates: string[] = Array.isArray(datesArrayRaw)
      ? Array.from(new Set((datesArrayRaw as any[])
        .map((d) => {
          if (typeof d !== 'string') return null;
          const p = new Date(d);
          if (Number.isNaN(p.getTime())) return null;
          return p.toISOString().split('T')[0];
        })
        .filter((d): d is string => typeof d === 'string')))
      : [];
    if (!normalizedTargetDate && single_day && normalizedDates.length === 1) {
      normalizedTargetDate = normalizedDates[0];
    }
    const isSingleDayRequest = Boolean(single_day) && Boolean(normalizedTargetDate);
    
    // Enhanced validation logging
    logEvent('info', 'staffing_email.validating_fields');
    
    if (!job_id || !profile_id || !["availability","offer"].includes(phase)) {
      const errorDetails = {
        missing_job_id: !job_id,
        missing_profile_id: !profile_id,
        invalid_phase: !["availability","offer"].includes(phase),
        received: { job_id, profile_id, phase }
      };
      logEvent('error', 'staffing_email.validation_failed');
      return new Response(JSON.stringify({ error: "Bad Request", details: errorDetails }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    logEvent('info', 'staffing_email.validation_passed_proceeding_with_email_send');

    // Idempotency check: prevent duplicate sends within 24h
    if (idempotency_key && typeof idempotency_key === 'string') {
      logEvent('info', 'staffing_email.checking_idempotency_key');
      const since24h = new Date(Date.now() - 24*60*60*1000).toISOString();
      
      const { data: existing, error: idempotencyError } = await supabase
        .from('staffing_requests')
        .select('id, status, created_at, role_code')
        .eq('idempotency_key', idempotency_key)
        .gte('created_at', since24h)
        .maybeSingle();

      if (idempotencyError) {
        logEvent('warn', 'staffing_email.idempotency_check_failed_non_blocking');
      } else if (existing) {
        if (phase === 'offer' && roleCode && !existing.role_code) {
          const { error: roleUpdateError } = await supabase
            .from('staffing_requests')
            .update({ role_code: roleCode })
            .eq('id', existing.id);
          if (roleUpdateError) {
            logEvent('warn', 'staffing_email.failed_to_backfill_role_code_on_idempotent_request_non_blocking');
          }
        }

        logEvent('info', 'staffing_email.idempotent_request_detected_returning_cached_response');
        return new Response(JSON.stringify({ 
          success: true, 
          cached: true,
          staffing_request_id: existing.id,
          message: 'Request already processed (idempotent)'
        }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        logEvent('info', 'staffing_email.new_idempotency_key_proceeding_with_send');
      }
    }

    // Check required environment variables
    logEvent('info', 'staffing_email.checking_env_variables');

    if (!TOKEN_SECRET || (desiredChannel === 'email' && (!BREVO_KEY || !BREVO_FROM))) {
      const missingEnvs = [];
      if (!TOKEN_SECRET) missingEnvs.push('STAFFING_TOKEN_SECRET');
      if (desiredChannel === 'email') {
        if (!BREVO_KEY) missingEnvs.push('BREVO_API_KEY');
        if (!BREVO_FROM) missingEnvs.push('BREVO_FROM');
      }
      
      logEvent('error', 'staffing_email.missing_env_variables');
      return new Response(JSON.stringify({ 
        error: "Server configuration error", 
        details: { missing_env_vars: missingEnvs }
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      // Step 1: Check daily cap
      logEvent('info', 'staffing_email.checking_daily_cap');
      const since = new Date(Date.now() - 24*60*60*1000).toISOString();
      const { count, error: capError } = await supabase.from("staffing_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since)
        .in("event", ["email_sent", "whatsapp_sent"]);
      
      if (capError) {
        logEvent('error', 'staffing_email.daily_cap_check_error');
        return new Response(JSON.stringify({ 
          error: "Database error checking daily cap", 
          details: capError 
        }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      logEvent('info', 'staffing_email.daily_cap_result', { count, limit: DAILY_CAP });
      if ((count ?? 0) >= DAILY_CAP) {
        logEvent('info', 'staffing_email.daily_cap_reached');
        return new Response(JSON.stringify({ 
          error: "Daily email limit reached", 
          details: { current: count, limit: DAILY_CAP }
        }), { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Step 2: Fetch job and profile data
      logEvent('info', 'staffing_email.fetching_job_and_profile_data');
      const roleDepartmentPromise = !departmentHint
        ? (() => {
          let query = supabase.from("job_required_roles")
            .select("department")
            .eq("job_id", job_id)
            .order("department", { ascending: true });
          if (roleCode) {
            query = query.eq("role_code", roleCode);
          }
          return query;
        })()
        : Promise.resolve({ data: null, error: null });
      const jobDepartmentsPromise = !departmentHint
        ? supabase.from("job_departments")
          .select("department")
          .eq("job_id", job_id)
          .order("department", { ascending: true })
        : Promise.resolve({ data: null, error: null });

      const [jobResult, techResult, actorResult, roleDepartmentResult, jobDepartmentsResult] = await Promise.all([
        supabase.from("jobs")
          .select(`
            id,
            title,
            start_time,
            end_time,
            tour_id,
            locations(formatted_address, latitude, longitude)
          `)
          .eq("id", job_id)
          .maybeSingle(),
        supabase.from("profiles").select("id,first_name,last_name,email,phone").eq("id", profile_id).maybeSingle(),
        actorId ? supabase.from("profiles").select("waha_endpoint, department").eq("id", actorId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        roleDepartmentPromise,
        jobDepartmentsPromise,
      ]);
      
      logEvent('info', 'staffing_email.job_result');
      logEvent('info', 'staffing_email.profile_result');
      if (roleDepartmentResult.error) {
        logEvent('warn', 'staffing_email.role_department_lookup_failed_non_blocking');
      }
      if (jobDepartmentsResult.error) {
        logEvent('warn', 'staffing_email.job_departments_lookup_failed_non_blocking');
      }

      if (jobResult.error) {
        logEvent('error', 'staffing_email.job_fetch_error');
        return new Response(JSON.stringify({ 
          error: "Error fetching job data", 
          details: jobResult.error 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (techResult.error) {
        logEvent('error', 'staffing_email.profile_fetch_error');
        return new Response(JSON.stringify({ 
          error: "Error fetching profile data", 
          details: techResult.error 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const job = jobResult.data;
      const tech = techResult.data;

      // Both queries use maybeSingle(): a missing row yields `data: null` with no error,
      // so the error checks above are not enough to guarantee either is present.
      if (!job || !tech) {
        logEvent('error', 'staffing_email.job_profile_not_found');
        return new Response(JSON.stringify({
          error: "Job or profile not found",
          details: { job_found: Boolean(job), profile_found: Boolean(tech) }
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const roleDepartmentRows = Array.isArray(roleDepartmentResult.data)
        ? roleDepartmentResult.data as Array<{ department?: string | null }>
        : [];
      const jobDepartmentRows = Array.isArray(jobDepartmentsResult.data)
        ? jobDepartmentsResult.data as Array<{ department?: string | null }>
        : [];
      const uniqueRoleDepartments = Array.from(new Set(
        roleDepartmentRows
          .map((row) => typeof row.department === 'string' ? row.department.trim() : '')
          .filter(Boolean)
      ));
      const uniqueJobDepartments = Array.from(new Set(
        jobDepartmentRows
          .map((row) => typeof row.department === 'string' ? row.department.trim() : '')
          .filter(Boolean)
      ));
      const roleDepartment = roleCode
        ? (typeof roleDepartmentRows[0]?.department === 'string' ? roleDepartmentRows[0].department.trim() || null : null)
        : uniqueRoleDepartments.length === 1 ? uniqueRoleDepartments[0] : null;
      const actorRow = actorResult.data as { department?: unknown } | null;
      const actorDepartment = typeof actorRow?.department === 'string'
        ? actorRow.department.trim() || null
        : null;
      const jobDepartment = uniqueJobDepartments.length === 1 ? uniqueJobDepartments[0] : null;
      const staffingDepartment = departmentHint || roleDepartment || actorDepartment || jobDepartment || null;
      
      if (!job) {
        logEvent('error', 'staffing_email.job_not_found');
        return new Response(JSON.stringify({ 
          error: "Job not found", 
          details: { job_id }
        }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Channel resolution
      // desiredChannel already computed above
      if (desiredChannel === 'email' && !tech?.email) {
        logEvent('error', 'staffing_email.profile_not_found_or_no_email');
        return new Response(JSON.stringify({ 
          error: "Profile not found or no email address", 
          details: { profile_id, has_profile: !!tech, has_email: !!tech?.email }
        }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (desiredChannel === 'whatsapp' && !tech?.phone) {
        logEvent('error', 'staffing_email.profile_has_no_phone_for_whatsapp');
        return new Response(JSON.stringify({ 
          error: "Profile has no phone number for WhatsApp", 
          details: { profile_id, has_phone: !!tech?.phone }
        }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Only users with waha_endpoint can send WhatsApp
      if (desiredChannel === 'whatsapp' && !actorResult.data?.waha_endpoint) {
        logEvent('error', 'staffing_email.actor_not_authorized_for_whatsapp');
        return new Response(JSON.stringify({ 
          error: "User not authorized for WhatsApp operations", 
          details: { actor_id: actorId }
        }), { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const fullName = `${tech.first_name || ''} ${tech.last_name || ''}`.trim();
      logEvent('info', 'staffing_email.tech_info');

      if (shouldRequireNoConflicts) {
        logEvent('info', 'staffing_email.recommendation_guard_verifying_candidate_is_still_eligible');
        const targetDates = normalizedDates.length > 0
          ? normalizedDates
          : (normalizedTargetDate ? [normalizedTargetDate] : datesBetween(job.start_time, job.end_time));

        const [
          targetAssignmentResult,
          activeAssignmentResult,
          sameRoleRequestResult,
          jobAvailabilityRequestResult,
          rolelessDeclineResult,
          crossJobDeclineResult,
          campaignPolicyResult,
        ] = await Promise.all([
          supabase
            .from('job_assignments')
            .select('id, job_id, status')
            .eq('job_id', job_id)
            .eq('technician_id', profile_id),
          supabase
            .from('job_assignments')
            .select('id, job_id, status, jobs(id, title, start_time, end_time, tour_id, locations(id, latitude, longitude))')
            .eq('technician_id', profile_id)
            .neq('job_id', job_id),
          roleCode
            ? supabase
              .from('staffing_requests')
              .select('id, phase, status, role_code, target_date, single_day, updated_at')
              .eq('job_id', job_id)
              .eq('profile_id', profile_id)
              .eq('role_code', roleCode)
              .in('phase', phase === 'offer' ? ['offer'] : ['availability', 'offer'])
              .in('status', ['pending', 'confirmed', 'declined'])
            : Promise.resolve({ data: [], error: null }),
          phase === 'availability'
            ? supabase
              .from('staffing_requests')
              .select('id, phase, status, role_code, target_date, single_day, updated_at')
              .eq('job_id', job_id)
              .eq('profile_id', profile_id)
              .eq('phase', 'availability')
              .in('status', ['pending', 'confirmed', 'declined'])
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from('staffing_requests')
            .select('id, phase, status, role_code, target_date, single_day, updated_at')
            .eq('job_id', job_id)
            .eq('profile_id', profile_id)
            .in('phase', ['availability', 'offer'])
            .eq('status', 'declined')
            .or('role_code.is.null,role_code.eq.'),
          supabase
            .from('staffing_requests')
            .select('id, job_id, phase, status, role_code, target_date, single_day, updated_at, jobs(id, title, start_time, end_time)')
            .eq('profile_id', profile_id)
            .neq('job_id', job_id)
            .eq('status', 'declined')
            .in('phase', ['availability', 'offer']),
          typeof campaign_id === 'string' && campaign_id
            ? supabase
              .from('staffing_campaigns')
              .select('policy, job_id')
              .eq('id', campaign_id)
              .eq('job_id', job_id)
              .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        const guardErrors = [
          targetAssignmentResult.error,
          activeAssignmentResult.error,
          sameRoleRequestResult.error,
          jobAvailabilityRequestResult.error,
          rolelessDeclineResult.error,
          crossJobDeclineResult.error,
          campaignPolicyResult.error,
        ].filter(Boolean);

        if (guardErrors.length > 0) {
          logEvent('error', 'staffing_email.recommendation_guard_failed');
          return new Response(JSON.stringify({
            error: 'Unable to verify technician availability',
            details: { errors: guardErrors },
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const activeTargetAssignments = (targetAssignmentResult.data || [])
          .filter((assignment: any) => assignment.status !== 'declined');

        const overlappingAssignments = (activeAssignmentResult.data || [])
          .filter((assignment: any) => assignment.status !== 'declined')
          .map((assignment: any) => ({
            ...assignment,
            job: joinedSingle(assignment.jobs),
          }))
          .filter((assignment: any) => rangesOverlapInclusive(
            assignment.job?.start_time,
            assignment.job?.end_time,
            job.start_time,
            job.end_time
          ));

        const sameRoleRequests = sameRoleRequestResult.data || [];
        const jobAvailabilityRequests = (jobAvailabilityRequestResult.data || [])
          .filter((request: any) => (
            request.status !== 'declined'
            || request.single_day === false
            || !request.target_date
            || targetDates.includes(request.target_date)
          ));
        const rolelessDeclines = (rolelessDeclineResult.data || [])
          .filter((request: any) => (
            request.single_day === false
            || !request.target_date
            || targetDates.includes(request.target_date)
          ));
        const crossJobDeclineRows = ((crossJobDeclineResult.data || []) as StaffingRequestDateScope[])
          .map((request) => ({
            ...request,
            job: joinedSingle(request.jobs),
          }))
          .filter((request) => staffingRequestOverlapsTargetDates(request, targetDates));
        const crossJobDeclineIds = crossJobDeclineRows
          .map((request) => String(request.id || ''))
          .filter(Boolean);
        const crossJobDeclineEventRoles = new Map<string, string>();
        const crossJobDeclinePhaseById = new Map(
          crossJobDeclineRows
            .map((request): [string, string | null] => [String(request.id || ''), request.phase || null])
            .filter(([requestId]) => Boolean(requestId))
        );
        if (crossJobDeclineIds.length > 0) {
          const { data: declineEvents, error: declineEventsError } = await supabase
            .from('staffing_events')
            .select('staffing_request_id, event, meta, created_at')
            .in('staffing_request_id', crossJobDeclineIds)
            .in('event', ['email_sent', 'whatsapp_sent'])
            .order('created_at', { ascending: false });

          if (declineEventsError) {
            logEvent('error', 'staffing_email.recommendation_guard_failed_cross_job_decline_role_lookup');
            return new Response(JSON.stringify({
              error: 'Unable to verify technician availability',
              details: { errors: [declineEventsError] },
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          for (const event of (declineEvents || []) as StaffingEventRoleRow[]) {
            const requestId = String(event.staffing_request_id || '');
            if (!requestId || crossJobDeclineEventRoles.has(requestId)) continue;
            const expectedPhase = crossJobDeclinePhaseById.get(requestId);
            const eventPhase = typeof event.meta?.phase === 'string'
              ? event.meta.phase.trim()
              : '';
            if (!expectedPhase || eventPhase !== expectedPhase) continue;
            const eventRole = typeof event.meta?.role === 'string'
              ? event.meta.role.trim()
              : '';
            if (eventRole) crossJobDeclineEventRoles.set(requestId, eventRole);
          }
        }
        const targetRolePrefix = staffingRolePrefix(roleCode);
        const crossJobDeclines = crossJobDeclineRows.filter((request) => {
          if (request.phase === 'availability') return true;
          const requestRole = typeof request.role_code === 'string' && request.role_code.trim()
            ? request.role_code
            : crossJobDeclineEventRoles.get(String(request.id || '')) || null;
          const requestRolePrefix = staffingRolePrefix(requestRole);
          return !targetRolePrefix || !requestRolePrefix || requestRolePrefix === targetRolePrefix;
        });
        const campaignPolicy = (campaignPolicyResult.data?.policy || {}) as any;
        const rolePolicy = roleCode && campaignPolicy?.role_profiles
          ? campaignPolicy.role_profiles[roleCode]
          : null;
        const adjacentGuardEnabled = campaignPolicy?.surrounding_jobs?.enabled !== false;
        const adjacentMaxDistanceKm = toFiniteNumber(campaignPolicy?.surrounding_jobs?.max_location_distance_km) ?? 25;
        const urgentAdjacentMode =
          campaignPolicy?.profile?.selected_job_profile === 'emergency_fill'
          || campaignPolicy?.profile?.inferred_job_profile === 'emergency_fill'
          || rolePolicy?.selected_profile === 'emergency_fill'
          || rolePolicy?.inferred_profile === 'emergency_fill';
        const sortedTargetDates = [...targetDates].sort();
        const previousTargetDate = addDaysToDateKey(sortedTargetDates[0], -1);
        const nextTargetDate = addDaysToDateKey(sortedTargetDates[sortedTargetDates.length - 1], 1);
        const targetLocation = jobLocation(job);
        const targetTourId = typeof job.tour_id === 'string' ? job.tour_id : null;
        const adjacentAssignments = (activeAssignmentResult.data || [])
          .filter((assignment: any) => assignment.status !== 'declined')
          .map((assignment: any) => ({
            ...assignment,
            job: joinedSingle(assignment.jobs),
          }))
          .filter((assignment: any) => {
            const assignmentTourId = typeof assignment.job?.tour_id === 'string' ? assignment.job.tour_id : null;
            if (targetTourId && assignmentTourId && targetTourId === assignmentTourId) return false;
            return dateKeyInRange(previousTargetDate, assignment.job?.start_time, assignment.job?.end_time)
              || dateKeyInRange(nextTargetDate, assignment.job?.start_time, assignment.job?.end_time);
          })
          .map((assignment: any) => {
            const otherLocation = jobLocation(assignment.job);
            return {
              id: assignment.id,
              status: assignment.status,
              job_id: assignment.job_id,
              title: assignment.job?.title,
              start_time: assignment.job?.start_time,
              end_time: assignment.job?.end_time,
              tour_id: assignment.job?.tour_id || null,
              distance_km: distanceKm(
                targetLocation.latitude,
                targetLocation.longitude,
                otherLocation.latitude,
                otherLocation.longitude,
              ),
            };
          });
        const blockingAdjacentAssignments = adjacentGuardEnabled && !urgentAdjacentMode
          ? adjacentAssignments.filter((assignment: any) =>
            assignment.distance_km === null || assignment.distance_km > adjacentMaxDistanceKm
          )
          : [];

        if (
          activeTargetAssignments.length > 0
          || overlappingAssignments.length > 0
          || blockingAdjacentAssignments.length > 0
          || sameRoleRequests.length > 0
          || jobAvailabilityRequests.length > 0
          || rolelessDeclines.length > 0
          || crossJobDeclines.length > 0
        ) {
          const blockDetails = {
            conflict_type: 'stale_recommendation',
            target_assignments: activeTargetAssignments,
            overlapping_assignments: overlappingAssignments.map((assignment: any) => ({
              id: assignment.id,
              status: assignment.status,
              job_id: assignment.job_id,
              title: assignment.job?.title,
              start_time: assignment.job?.start_time,
              end_time: assignment.job?.end_time,
            })),
            adjacent_assignments: blockingAdjacentAssignments,
            adjacent_job_policy: {
              enabled: adjacentGuardEnabled,
              urgent: urgentAdjacentMode,
              max_location_distance_km: adjacentMaxDistanceKm,
              previous_target_date: previousTargetDate,
              next_target_date: nextTargetDate,
            },
            same_role_requests: sameRoleRequests,
            job_availability_requests: jobAvailabilityRequests,
            roleless_declines: rolelessDeclines,
            cross_job_declines: crossJobDeclines.map((request) => ({
              id: request.id,
              job_id: request.job_id,
              phase: request.phase,
              status: request.status,
              role_code: request.role_code || crossJobDeclineEventRoles.get(String(request.id || '')) || null,
              target_date: request.target_date,
              single_day: request.single_day,
              updated_at: request.updated_at,
              title: request.job?.title,
              start_time: request.job?.start_time,
              end_time: request.job?.end_time,
            })),
            target_dates: targetDates,
            target_job: {
              id: job.id,
              title: job.title,
            },
            technician: { id: tech.id, name: fullName },
          };

          logEvent('info', 'staffing_email.blocking_send_stale_candidate_is_no_longer_eligible');
          return new Response(JSON.stringify({
            error: 'Technician is no longer available for this recommendation',
            details: blockDetails,
          }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Step 2b: Enhanced conflict check using RPC function
      // Checks for both hard conflicts (confirmed) and soft conflicts (pending)
      // Manual sends stay warning-only; recommendation sends can opt into hard blocking
      // with require_no_conflicts so stale candidate lists do not create collisions.
      const conflictWarnings: any[] = [];
      if (shouldOverrideConflicts && !shouldRequireNoConflicts) {
        logEvent('info', 'staffing_email.conflict_check_overridden_by_user_skipping_conflict_detection');
      } else {
        try {
          logEvent('info', 'staffing_email.conflict_check_using_enhanced_rpc_conflict_checker');

          // Check conflicts for each date if multi-date, otherwise for single date or whole job
          const datesToCheck = normalizedDates.length > 0 ? normalizedDates : [normalizedTargetDate];

          for (const dateToCheck of datesToCheck) {
            const { data: conflictResult, error: conflictErr } = await supabase.rpc(
              'check_technician_conflicts',
              {
                _technician_id: profile_id,
                _target_job_id: job_id,
                _target_date: dateToCheck,
                _single_day: isSingleDayRequest,
                _include_pending: true // Check both confirmed and pending assignments
              }
            );

            if (conflictErr) {
              logEvent('warn', 'staffing_email.conflict_check_failed');
              if (shouldRequireNoConflicts) {
                return new Response(JSON.stringify({
                  error: 'Unable to verify technician availability',
                  details: conflictErr,
                }), {
                  status: 500,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }
            } else if (conflictResult) {
              const hardConflicts = Array.isArray(conflictResult.hardConflicts) ? conflictResult.hardConflicts : [];
              const softConflicts = Array.isArray(conflictResult.softConflicts) ? conflictResult.softConflicts : [];
              const unavailabilityConflicts = Array.isArray(conflictResult.unavailabilityConflicts)
                ? conflictResult.unavailabilityConflicts
                : [];
              const hasHardConflict = Boolean(conflictResult.hasHardConflict) || hardConflicts.length > 0;
              const hasSoftConflict = Boolean(conflictResult.hasSoftConflict) || softConflicts.length > 0;
              const hasUnavailability = unavailabilityConflicts.length > 0;

              if (shouldRequireNoConflicts && (hasHardConflict || hasUnavailability)) {
                const blockDetails = {
                  conflict_type: hasHardConflict ? 'hard_conflict' : 'unavailability',
                  hard_conflicts: hardConflicts,
                  unavailability_conflicts: unavailabilityConflicts,
                  unavailability: unavailabilityConflicts,
                  target_date: dateToCheck,
                  target_job: {
                    id: job.id,
                    title: job.title,
                  },
                  technician: { id: tech.id, name: fullName },
                };

                logEvent('info', 'staffing_email.blocking_send_candidate_no_longer_has_clean_availability');

                return new Response(JSON.stringify({
                  error: 'Technician is no longer available for this recommendation',
                  details: blockDetails,
                }), {
                  status: 409,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }

              if (!hasHardConflict && !hasSoftConflict && !hasUnavailability) {
                continue;
              }

              const conflictType = hasHardConflict ? 'confirmed' : (hasUnavailability ? 'unavailability' : 'pending');
              const conflicts = hasHardConflict ? hardConflicts : softConflicts;

              logEvent('info', 'staffing_email.conflict_detected_warning_only_not_blocking');

              // Accumulate conflict warnings for metadata logging (don't overwrite)
              conflictWarnings.push({
                conflict_type: conflictType,
                conflicts: conflicts,
                unavailability: unavailabilityConflicts,
                target_date: dateToCheck
              });
            }
          }

          if (conflictWarnings.length > 0) {
            logEvent('info', 'staffing_email.conflicts_detected_but_allowing_send_to_proceed_conflicts_logged_as_warnings');
          } else {
            logEvent('info', 'staffing_email.no_conflicts_detected_proceeding_to_send_email');
          }
        } catch (conflictCheckErr) {
          logEvent('warn', 'staffing_email.conflict_check_encountered_an_error_continuing_to_send_email');
        }
      }

      // Step 2c: Hard block for actual timesheet conflicts on specific dates
      // CRITICAL: This check is NOT overridable - prevents real double-bookings
      // Runs regardless of shouldOverrideConflicts flag
      try {
        logEvent('info', 'staffing_email.timesheet_check_verifying_no_double_booking_on_exact_dates');

        // Determine dates to check: use explicit dates if provided, otherwise derive from job
        let datesToCheck = normalizedDates.length > 0 ? normalizedDates : (normalizedTargetDate ? [normalizedTargetDate] : []);

        // If no explicit dates (whole-span request), derive from job start/end dates
        if (datesToCheck.length === 0 && job.start_time && job.end_time) {
          const jobStart = new Date(job.start_time);
          const jobEnd = new Date(job.end_time);
          const dates: string[] = [];
          for (let d = new Date(jobStart); d <= jobEnd; d.setDate(d.getDate() + 1)) {
            dates.push(d.toISOString().split('T')[0]);
          }
          datesToCheck = dates;
          logEvent('info', 'staffing_email.whole_span_request_detected_checking_dates_from_job_span');
        }

        if (datesToCheck.length > 0) {
          // Check if technician already has ACTIVE timesheets for these exact dates
          // Voided timesheets (is_active = false) don't count as conflicts
          const { data: existingTimesheets, error: timesheetErr } = await supabase
            .from('timesheets')
            .select('date, job_id, jobs(title)')
            .eq('technician_id', profile_id)
            .in('date', datesToCheck)
            .neq('job_id', job_id)
            .eq('is_active', true); // Only check active timesheets

          if (timesheetErr) {
            logEvent('warn', 'staffing_email.timesheet_check_failed_continuing');
          } else if (existingTimesheets && existingTimesheets.length > 0) {
            // Found actual timesheet conflicts - this is a real double-booking
            const conflictDates = existingTimesheets.map(ts => ({
              date: ts.date,
              job_title: (ts.jobs as any)?.title || 'Unknown Job'
            }));

            logEvent('info', 'staffing_email.hard_conflict_timesheet_already_exists_for_exact_dates');

            return new Response(JSON.stringify({
              error: 'Technician already has confirmed work on these dates',
              details: {
                conflict_type: 'timesheet',
                dates: conflictDates,
                target_job: {
                  id: job.id,
                  title: job.title,
                },
                technician: { id: tech.id, name: fullName },
                note: 'This is a hard block that cannot be overridden - technician already has timesheets for these dates'
              }
            }), {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            logEvent('info', 'staffing_email.no_timesheet_conflicts_on_exact_dates');
          }
        }
      } catch (timesheetCheckErr) {
        logEvent('warn', 'staffing_email.timesheet_check_encountered_an_error_continuing');
      }

      // Step 3: Determine request id (rid) and batch shape
      // For batch requests, we may already have a pending row for the first date.
      // In that case we reuse its id so the confirm link points at a real row.
      const isBatch = normalizedDates.length > 1;
      let batchId: string | null = null;
      let rid: string = crypto.randomUUID();
      let firstDate: string | null = null;
      let existingFirstRowId: string | null = null;

      if (isBatch) {
        firstDate = normalizedDates[0] || null;
        if (firstDate) {
          const { data: existingFirst, error: existingFirstErr } = await supabase
            .from('staffing_requests')
            .select('id,batch_id')
            .eq('job_id', job_id)
            .eq('profile_id', profile_id)
            .eq('phase', phase)
            .eq('status', 'pending')
            .eq('single_day', true)
            .eq('target_date', firstDate)
            .maybeSingle();

          if (existingFirstErr) {
            logEvent('warn', 'staffing_email.failed_to_check_existing_first_batch_row_continuing_with_new_rid');
          }

          if (existingFirst?.id) {
            existingFirstRowId = existingFirst.id as string;
            rid = existingFirstRowId;
            batchId = ((existingFirst as Record<string, unknown>)?.batch_id as (string | null | undefined)) ?? null;
          }
        }
      }

      // Step 4: Generate token (must use the final rid)
      logEvent('info', 'staffing_email.generating_token');
      const exp = new Date(Date.now() + 1000*60*60*48).toISOString();
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(TOKEN_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key,
        new TextEncoder().encode(`${rid}:${phase}:${exp}`)));
      let token = b64url(sig);

      // Store only hash of token bytes
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", sig));
      let token_hash = Array.from(digest).map(x=>x.toString(16).padStart(2,'0')).join('');
      logEvent('info', 'staffing_email.token_generated');

      // Step 5: Insert/update staffing request(s)
      logEvent('info', 'staffing_email.saving_staffing_request');
      let insertedId = rid;

      // If multiple dates are provided, create a batch of single-day requests and use one of them for the email link
      if (isBatch) {
        if (!batchId) batchId = crypto.randomUUID();
        if (!firstDate) firstDate = normalizedDates[0] || null;
        if (!firstDate) {
          return new Response(JSON.stringify({ error: 'Bad Request', details: { reason: 'Missing first batch date' } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (existingFirstRowId) {
          // Reuse existing row: refresh token + expiry + batch association.
          const upd = await supabase
            .from('staffing_requests')
            .update({
              requested_by: actorId,
              token_hash,
              token_expires_at: exp,
              updated_at: new Date().toISOString(),
              batch_id: batchId,
              idempotency_key: idempotency_key || null,
              ...roleCodePatch,
            })
            .eq('id', existingFirstRowId)
            .select('id')
            .maybeSingle();

          if (upd.error) {
            logEvent('error', 'staffing_email.staffing_request_batch_first_update_error');
            return new Response(JSON.stringify({ error: 'Database error updating first batch request', details: upd.error }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        } else {
          // Insert first date as the clickable rid row
          const firstInsert = await supabase.from('staffing_requests').insert({
            id: rid,
            job_id,
            profile_id,
            phase,
            status: 'pending',
            requested_by: actorId,
            token_hash,
            token_expires_at: exp,
            single_day: true,
            target_date: firstDate,
            batch_id: batchId,
            idempotency_key: idempotency_key || null,
            ...roleCodePatch,
          });
          if (firstInsert.error) {
            const code = firstInsert.error.code;
            const msg = firstInsert.error.message ?? '';
            const isDuplicate = code === '23505' || /duplicate key/i.test(msg);

            if (isDuplicate) {
              logEvent('warn', 'staffing_email.batch_first_insert_duplicate_race_reselecting_existing_row_and_updating_token');
              const { data: existingAfterRace, error: existingAfterRaceErr } = await supabase
                .from('staffing_requests')
                .select('id')
                .eq('job_id', job_id)
                .eq('profile_id', profile_id)
                .eq('phase', phase)
                .eq('status', 'pending')
                .eq('single_day', true)
                .eq('target_date', firstDate)
                .maybeSingle();

              if (existingAfterRaceErr || !existingAfterRace?.id) {
                logEvent('error', 'staffing_email.staffing_request_batch_duplicate_failed_to_find_existing_row_after_race');
                return new Response(JSON.stringify({ error: 'Database error saving first batch request', details: firstInsert.error }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
              }

              // Reuse the existing row id as insertedId (confirm link)
              insertedId = existingAfterRace.id as string;

              // IMPORTANT: token is signed with rid, so if we switch to an existing row id
              // we must re-derive token + token_hash so the confirm link validates.
              rid = insertedId;
              const sig2 = new Uint8Array(await crypto.subtle.sign(
                "HMAC",
                key,
                new TextEncoder().encode(`${rid}:${phase}:${exp}`)
              ));
              token = b64url(sig2);
              const digest2 = new Uint8Array(await crypto.subtle.digest("SHA-256", sig2));
              token_hash = Array.from(digest2).map(x => x.toString(16).padStart(2, '0')).join('');

              const upd = await supabase
                .from('staffing_requests')
                .update({
                  requested_by: actorId,
                  token_hash,
                  token_expires_at: exp,
                  updated_at: new Date().toISOString(),
                  batch_id: batchId,
                  idempotency_key: idempotency_key || null,
                  ...roleCodePatch,
                })
                .eq('id', insertedId)
                .select('id')
                .maybeSingle();

              if (upd.error) {
                logEvent('error', 'staffing_email.staffing_request_batch_duplicate_update_error');
                return new Response(JSON.stringify({ error: 'Database error updating first batch request', details: upd.error }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
              }
            } else {
              logEvent('error', 'staffing_email.staffing_request_batch_first_insert_error');
              return new Response(JSON.stringify({ error: 'Database error saving first batch request', details: firstInsert.error }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
          }
        }

        // Insert remaining dates - use insert with ignoreDuplicates since the unique constraint
        // is a partial index that upsert's onConflict can't properly match
        const rest = normalizedDates.slice(1).map(d => ({
          job_id,
          profile_id,
          phase,
          status: 'pending',
          requested_by: actorId,
          token_hash, // placeholder; not used for click on these rows
          token_expires_at: exp,
          single_day: true,
          target_date: d,
          batch_id: batchId,
          ...roleCodePatch,
        }));
        if (rest.length) {
          logEvent('info', 'staffing_email.inserting_batch_dates');
          const up = await supabase
            .from('staffing_requests')
            .insert(rest, { ignoreDuplicates: true } as any);
          if (up.error) {
            logEvent('warn', 'staffing_email.batch_insert_had_errors');
          } else {
            logEvent('info', 'staffing_email.successfully_inserted_batch_dates');
          }
        }

        // Ensure all rows for this batch share the same batch_id (ignoreDuplicates won't update existing rows)
        try {
          const cohesion = await supabase
            .from('staffing_requests')
            .update({ requested_by: actorId, batch_id: batchId, updated_at: new Date().toISOString(), ...roleCodePatch })
            .eq('job_id', job_id)
            .eq('profile_id', profile_id)
            .eq('phase', phase)
            .eq('status', 'pending')
            .eq('single_day', true)
            .in('target_date', normalizedDates);
          if (cohesion.error) {
            logEvent('warn', 'staffing_email.batch_id_cohesion_update_returned_error_non_fatal');
          }
        } catch (e) {
          logEvent('warn', 'staffing_email.failed_to_enforce_batch_id_cohesion_non_fatal');
        }
      } else {
        // Single request as before
        const insertRes = await supabase.from("staffing_requests").insert({
          id: rid,
          job_id,
          profile_id,
          phase,
          status: "pending",
          requested_by: actorId,
          token_hash,
          token_expires_at: exp,
          single_day: isSingleDayRequest,
          target_date: normalizedTargetDate,
          idempotency_key: idempotency_key || null,
          ...roleCodePatch,
        });
        if (insertRes.error && insertRes.error.code === "23505") {
          logEvent('info', 'staffing_email.duplicate_found_updating');
          // Target the exact pending row shape to avoid touching unrelated requests
          let updater = supabase
            .from("staffing_requests")
            .update({
              requested_by: actorId,
              token_hash,
              token_expires_at: exp,
              updated_at: new Date().toISOString(),
              ...roleCodePatch,
              // keep existing shape; do not convert full-span to single-day or vice versa
            })
            .eq("job_id", job_id)
            .eq("profile_id", profile_id)
            .eq("phase", phase)
            .eq("status", "pending")
            .eq('single_day', !!isSingleDayRequest);

          if (isSingleDayRequest && normalizedTargetDate) {
            updater = updater.eq('target_date', normalizedTargetDate);
          }

          const upd = await updater.select("id").maybeSingle();
          logEvent('info', 'staffing_email.update_result');
          if (upd.data?.id) insertedId = upd.data.id;
        } else if (insertRes.error) {
          logEvent('error', 'staffing_email.staffing_request_insert_error');
          return new Response(JSON.stringify({ error: "Database error saving request", details: insertRes.error }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Optional: generate signed URL for a tour schedule PDF
      let tourPdfSignedUrl: string | null = null;
      try {
        if (typeof tour_pdf_path === 'string' && tour_pdf_path.trim()) {
          const { data: signed, error: sigErr } = await supabase
            .storage
            .from('tour-documents')
            .createSignedUrl(tour_pdf_path, 60 * 60 * 24 * 7);
          if (!sigErr && signed?.signedUrl) tourPdfSignedUrl = signed.signedUrl;
        }
      } catch (e) {
        logEvent('warn', 'staffing_email.failed_to_sign_tour_pdf_path');
      }

      // Step 5: Build content (email or whatsapp)
      logEvent('info', 'staffing_email.building_email_content');
      const emailConfirmUrl = buildLegacyStaffingActionUrl({
        base: __DEFAULT_CONFIRM_BASE,
        rid: insertedId,
        action: 'confirm',
        exp,
        token,
        channel: desiredChannel,
      });
      const emailDeclineUrl = buildLegacyStaffingActionUrl({
        base: __DEFAULT_CONFIRM_BASE,
        rid: insertedId,
        action: 'decline',
        exp,
        token,
        channel: desiredChannel,
      });
      const whatsappConfirmUrl = buildPathStaffingActionUrl(
        STAFFING_CONFIRM_BASE,
        'confirm',
        insertedId,
        token,
      );
      const whatsappDeclineUrl = buildPathStaffingActionUrl(
        STAFFING_CONFIRM_BASE,
        'decline',
        insertedId,
        token,
      );

      const roleLabel = labelForRoleCode(roleCode) || null;
      const subject = phase === "availability"
        ? `Consulta de disponibilidad`
        : `Oferta: ${job.title}${roleLabel ? ` — ${roleLabel}` : ''}`;

      // Spanish date/time formatting
      const fmtDate = (d?: string | null) => d ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeStyle: undefined, timeZone: COMPANY_TZ }).format(new Date(d)) : 'TBD';
      const fmtTime = (d?: string | null) => d ? new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: COMPANY_TZ }).format(new Date(d)) : 'TBD';
      const startDate = fmtDate(job.start_time);
      const endDate = fmtDate(job.end_time);
      const callTime = fmtTime(job.start_time);
      const targetDateLabel = normalizedTargetDate ? fmtDate(`${normalizedTargetDate}T00:00:00Z`) : null;
      const loc = joinedSingle(job.locations)?.formatted_address ?? 'Por confirmar';

      const safeMessage = escapeHtml(message ?? '').replace(/\n/g, '<br/>');
      const safeSubject = escapeHtml(subject);
      const safeFullName = escapeHtml(fullName || '');
      const safeJobTitle = escapeHtml(String(job.title ?? ''));
      const safeRoleLabel = roleLabel ? escapeHtml(roleLabel) : null;
      const safeLocation = escapeHtml(loc);

      const primaryCta = phase === 'availability' ? 'Estoy disponible' : 'Acepto la oferta';
      const secondaryCta = phase === 'availability' ? 'No estoy disponible' : 'Rechazo la oferta';
      // Build date row depending on single-day vs span
      const datesRowHtml = (isSingleDayRequest && targetDateLabel)
        ? `<div><b>Fecha:</b> ${escapeHtml(String(targetDateLabel))}</div>`
        : `<div><b>Fechas:</b> ${escapeHtml(String(startDate))}${job.end_time ? ` — ${escapeHtml(String(endDate))}` : ''}</div>`;

      const multiDatesHtml = normalizedDates.length > 1
        ? `<div><b>Fechas seleccionadas:</b></div><ul style="margin:8px 0 0 16px;padding:0;">${normalizedDates.map(d => `<li>${escapeHtml(String(fmtDate(`${d}T00:00:00Z`)))}</li>`).join('')}</ul>`
        : '';
      const dateDetailsHtml = normalizedDates.length > 1 ? multiDatesHtml : datesRowHtml;
      const offerDetailsHtml = phase === 'offer'
        ? `
                            <div><b>Horario:</b> ${escapeHtml(String(callTime))}</div>
                            <div><b>Ubicación:</b> ${safeLocation}</div>
                            ${safeRoleLabel ? `<div><b>Rol:</b> ${safeRoleLabel}</div>` : ''}`
        : '';
      const detailsTitle = phase === 'availability' ? 'Fechas consultadas' : 'Detalles del trabajo';

      // Determine singular vs plural for availability message
      const isMultipleDates = normalizedDates.length > 1;
      const datePhrasing = isMultipleDates ? 'las fechas indicadas más abajo' : 'la fecha indicada más abajo';
      const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${safeSubject}</title>
      </head>
      <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:24px;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.06);">
                <tr>
                  <td style="padding:16px 20px;background:#0b0b0b;">
                    <table width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="left" style="vertical-align:middle;">
                          <a href="https://www.sector-pro.com" target="_blank" rel="noopener noreferrer">
                            <img src="${escapeHtml(String(COMPANY_LOGO_URL))}" alt="Sector Pro" height="36" style="display:block;border:0;max-height:36px" />
                          </a>
                        </td>
                        <td align="right" style="vertical-align:middle;">
                          <a href="https://sector-pro.work" target="_blank" rel="noopener noreferrer">
                            <img src="${escapeHtml(String(AT_LOGO_URL))}" alt="Área Técnica" height="36" style="display:block;border:0;max-height:36px" />
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 24px 8px 24px;">
                    <h2 style="margin:0 0 8px 0;font-size:20px;color:#111827;">Hola ${safeFullName},</h2>
                    <p style="margin:0;color:#374151;line-height:1.55;">
                      ${phase === 'availability'
                        ? `¿Tendrías disponibilidad para ${datePhrasing}?`
                        : `Tienes una oferta para <b>${safeJobTitle}</b>. Por favor, confirma:`}
                    </p>
                    ${phase === 'availability'
                      ? `<p style="margin:12px 0 0 0;color:#374151;line-height:1.55;"><b>ATENCIÓN:</b> Este email SOLO confirma disponibilidad, no te cierra el evento.<br/>Si confirmas, recibirás un segundo email con la oferta de trabajo detallada.</p>`
                      : ''}
                    ${phase === 'offer' && safeRoleLabel ? `<p style="margin:8px 0 0 0;color:#111827;"><b>Puesto:</b> ${safeRoleLabel}</p>` : ''}
                    ${phase === 'offer' && message ? `<p style="margin:12px 0 0 0;color:#374151;">${safeMessage}</p>` : ''}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 24px 0 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
                      <tr>
                        <td style="padding:16px;">
                          <div style="color:#111827;font-weight:bold;margin-bottom:4px;">${detailsTitle}</div>
                          <div style="color:#374151;line-height:1.55;">
                            ${dateDetailsHtml}
                            ${offerDetailsHtml}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${phase === 'offer' && tourPdfSignedUrl ? `
                <tr>
                  <td style="padding:12px 24px 0 24px;">
                    <div style=\"background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;\">
                      <div style=\"font-weight:600;color:#9a3412;margin-bottom:4px;\">Calendario del tour (PDF)</div>
                      <a href=\"${escapeHtml(String(tourPdfSignedUrl))}\" style=\"color:#9a3412;text-decoration:underline;\">Descargar PDF</a>
                    </div>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding:16px 24px 24px 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;">
                      <tr>
                        <td align="left" style="padding:8px 0;">
                          <a href="${escapeHtml(String(emailConfirmUrl))}" style="display:inline-block;background:#10b981;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">${primaryCta}</a>
                        </td>
                        <td align="right" style="padding:8px 0;">
                          <a href="${escapeHtml(String(emailDeclineUrl))}" style="display:inline-block;background:#ef4444;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">${secondaryCta}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.5;border-top:1px solid #e5e7eb;">
                    <div style="margin-bottom:8px;">
                      Este correo es confidencial y puede contener información privilegiada. Si no eres el destinatario, por favor notifícanos y elimina este mensaje.
                    </div>
                    <div>
                      Sector Pro · <a href="https://www.sector-pro.com" style="color:#6b7280;text-decoration:underline;">www.sector-pro.com</a>
                      &nbsp;|&nbsp; Área Técnica · <a href="https://sector-pro.work" style="color:#6b7280;text-decoration:underline;">sector-pro.work</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>`;

      // Step 6: Deliver via chosen channel
      logEvent('info', 'staffing_email.confirm_links_generated');
      if (desiredChannel === 'whatsapp') {
        const text = buildWhatsAppStaffingMessage({
          phase,
          fullName,
          jobTitle: job.title,
          roleLabel,
          note: phase === 'offer' ? message : null,
          normalizedDates: normalizedDates.map((d) => fmtDate(`${d}T00:00:00Z`)),
          isSingleDayRequest,
          targetDateLabel,
          startDate,
          endDate,
          callTime,
          location: loc,
          tourPdfSignedUrl: phase === 'offer' ? tourPdfSignedUrl : null,
          confirmUrl: whatsappConfirmUrl,
          declineUrl: whatsappDeclineUrl,
        });

        // WAHA config - use actor's endpoint
        const normalizeBase = (s: string) => {
          let b = (s || '').trim();
          if (!/^https?:\/\//i.test(b)) b = 'https://' + b;
          return b.replace(/\/+$/, '');
        };
        const base = normalizeBase(actorResult.data?.waha_endpoint || 'https://waha.sector-pro.work');
        const { data: cfg } = await supabase.rpc('get_waha_config', { base_url: base });
        const apiKey = (cfg?.[0] as any)?.api_key || Deno.env.get('WAHA_API_KEY') || '';
        const session = (cfg?.[0] as any)?.session || Deno.env.get('WAHA_SESSION') || 'default';
        const defaultCC = Deno.env.get('WA_DEFAULT_COUNTRY_CODE') || '+34';
        const headersWA: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) headersWA['X-API-Key'] = apiKey;

        const requestId = crypto.randomUUID();
        try {
          logEvent('info', 'staffing_email.wa_request_started');
        } catch {}

        // Normalize phone → JID
        function normalizePhone(raw: string, defaultCountry: string): { ok: true; value: string } | { ok: false; reason: string } {
          if (!raw) return { ok: false, reason: 'empty' } as const;
          const trimmed = raw.trim();
          if (!trimmed) return { ok: false, reason: 'empty' } as const;
          let digits = trimmed.replace(/[\s\-()]/g, '');
          if (digits.startsWith('00')) digits = '+' + digits.slice(2);
          if (!digits.startsWith('+')) {
            if (/^[67]\d{8}$/.test(digits)) {
              digits = '+34' + digits;
            } else {
              const cc = defaultCountry.startsWith('+') ? defaultCountry : `+${defaultCountry}`;
              digits = cc + digits;
            }
          }
          if (!/^\+\d{7,15}$/.test(digits)) return { ok: false, reason: 'invalid_format' } as const;
          return { ok: true, value: digits } as const;
        }

        const norm = normalizePhone(tech.phone || '', defaultCC);
        if (!norm.ok) {
          return new Response(JSON.stringify({ error: 'Invalid phone format for WhatsApp' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const chatId = norm.value.replace(/^\+/, '').replace(/\D/g, '') + '@c.us';
        const basePayload = { chatId, text, linkPreview: false } as const;
        // WAHA deployments can differ by version/proxy. Try multiple compatible variants.
        const attemptCandidates = [
          { url: `${base}/api/${encodeURIComponent(session)}/sendText`, body: { ...basePayload } },
          { url: `${base}/api/sendText`, body: { ...basePayload, session } },
          { url: `${base}/api/sendText?session=${encodeURIComponent(session)}`, body: { ...basePayload } },
          { url: `${base}/api/sendText`, body: { ...basePayload } },
        ] as const;
        const seenAttempts = new Set<string>();
        const attempts = attemptCandidates.filter((candidate) => {
          const key = `${candidate.url}|${JSON.stringify(candidate.body)}`;
          if (seenAttempts.has(key)) return false;
          seenAttempts.add(key);
          return true;
        });

        // Timeouts and helpers
        const timeoutMs = Number(Deno.env.get('WAHA_FETCH_TIMEOUT_MS') || 15000);
        const overallMs = Number(Deno.env.get('STAFFING_WA_OVERALL_TIMEOUT_MS') || 14000);
        const started = Date.now();
        const fetchWithTimeout = async (url: string, init: RequestInit, ms: number) => {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(new DOMException('timeout','AbortError')), ms);
          try { return await fetch(url, { ...init, signal: controller.signal }); } finally { clearTimeout(t); }
        };
        const parseCF524 = (body: string) => {
          const is524 = /Error code\s*524/i.test(body) || /cloudflare/i.test(body);
          if (!is524) return null;
          const ray = (body.match(/Cloudflare Ray ID:\s*<strong[^>]*>([^<]+)/i)?.[1]) || (body.match(/Ray ID:\s*([a-z0-9]+)/i)?.[1]) || null;
          return { rayId: ray };
        };
        const truncate = (v?: string | null, max = 2000) => !v ? '' : (v.length > max ? v.slice(0, max) + '…' : v);
        const interpretResponse = (payload: unknown): { ok: boolean; reason?: string } => {
          if (!payload || typeof payload !== 'object') return { ok: true };
          const obj = payload as Record<string, unknown>;
          if (obj.success === false) return { ok: false, reason: typeof obj.message === 'string' ? obj.message : 'WAHA reported success=false' };
          if (obj.error && typeof obj.error === 'string') return { ok: false, reason: obj.error };
          if (Array.isArray((obj as any).errors) && (obj as any).errors.length) return { ok: false, reason: String((obj as any).errors) };
          if (typeof (obj as any).status === 'string') {
            const lowered = String((obj as any).status).toLowerCase();
            if (['error','fail','failed'].includes(lowered)) return { ok: false, reason: String((obj as any).message || lowered) };
            if (['success','ok'].includes(lowered)) return { ok: true };
          }
          if ((obj as any).success === true) return { ok: true };
          if ('result' in obj && (obj as any).result !== undefined) return { ok: true };
          if ('data' in obj && (obj as any).data !== undefined) return { ok: true };
          if ('id' in obj || 'messageId' in obj) return { ok: true };
          return { ok: true };
        };

        type AttemptErr = { url: string; step: 'http'|'fetch'|'api'; status?: number; body?: string; json?: Record<string, unknown>|null; message?: string; cloudflareRayId?: string|null };
        const attemptErrors: AttemptErr[] = [];
        let waOk = false;
        let lastStatus: number | undefined;

        for (const attempt of attempts) {
          const elapsed = Date.now() - started;
          const remaining = overallMs - elapsed - 200;
          if (remaining <= 200) {
            attemptErrors.push({ url: attempt.url, step: 'fetch', message: 'skipped_due_to_time_budget' });
            continue;
          }
          try {
            const ms = Math.min(timeoutMs, Math.max(500, remaining));
            const res = await fetchWithTimeout(attempt.url, { method: 'POST', headers: headersWA, body: JSON.stringify(attempt.body) }, ms);
            lastStatus = res.status;
            const ct = res.headers.get('content-type') || '';
            let parsed: Record<string, unknown> | null = null;
            let textBody: string | null = null;
            if (/application\/json/i.test(ct)) parsed = await res.json().catch(() => null) as any;
            else textBody = await res.text().catch(() => null);
            if (!res.ok) {
              const bodyStr = parsed ? JSON.stringify(parsed) : textBody || '';
              const cf = res.status === 524 && bodyStr ? parseCF524(bodyStr) : null;
              logEvent('warn', 'staffing_email.waha_non_ok', { status: res.status });
              attemptErrors.push({ url: attempt.url, step: 'http', status: res.status, body: truncate(bodyStr), cloudflareRayId: cf?.rayId || null });
              continue;
            }
            const interpretation = interpretResponse(parsed);
            if (interpretation.ok) { waOk = true; break; }
            const serialized = parsed ? JSON.stringify(parsed) : textBody || '';
            logEvent('warn', 'staffing_email.waha_reported_failure');
            attemptErrors.push({ url: attempt.url, step: 'api', status: res.status, json: parsed, body: truncate(serialized), message: interpretation.reason });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logEvent('warn', 'staffing_email.waha_fetch_error');
            attemptErrors.push({ url: attempt.url, step: 'fetch', message });
          }
        }

        // Log event with final observed status (even if failure) to keep existing analytics behavior
        await supabase.from('staffing_events').insert({
          staffing_request_id: insertedId,
          event: 'whatsapp_sent',
          meta: {
            phase,
            status: waOk ? 200 : (lastStatus ?? 0),
            role: roleCode,
            request_origin: request_origin ?? null,
            campaign_id: campaign_id ?? null,
            single_day: isSingleDayRequest || isBatch,
            target_date: normalizedTargetDate,
            dates: normalizedDates,
            conflict_warnings: conflictWarnings // Include conflict warnings in metadata for tracking
          }
        });

        if (waOk) {
          emitStaffingPush({
            channel: 'whatsapp',
            jobId: job_id,
            profileId: profile_id,
            actorId: actorId || null,
            department: staffingDepartment,
            staffingRequestId: insertedId,
            phase,
            roleCode,
            targetDate: normalizedTargetDate,
            singleDay: isSingleDayRequest || isBatch,
            requestOrigin: request_origin,
            campaignId: campaign_id,
          });
          try {
            const activityCode = phase === 'availability' ? 'staffing.availability.sent' : 'staffing.offer.sent';
            await supabase.rpc('log_activity_as', {
              _actor_id: actorId,
              _code: activityCode,
              _job_id: job_id,
              _entity_type: 'staffing',
              _entity_id: insertedId,
              _payload: { staffing_request_id: insertedId, phase, profile_id, tech_name: fullName || tech.email || tech.phone },
              _visibility: null,
            });
          } catch (activityError) {
            logEvent('warn', 'staffing_email.failed_to_log_activity_whatsapp');
          }
          return new Response(JSON.stringify({ success: true, channel: 'whatsapp' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const errorPayload = { error: 'WhatsApp delivery failed', request_id: requestId, context: { base, session, chatIdSuffix: (tech.phone || '').slice(-4) }, attempts: attemptErrors };
        const statusToReturn = typeof lastStatus === 'number' && lastStatus >= 400 ? lastStatus : 502;
        return new Response(JSON.stringify(errorPayload), { status: statusToReturn, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else {
        // Email channel via Brevo
        logEvent('info', 'staffing_email.sending_email_via_brevo');
        const emailPayload = {
          sender: { email: BREVO_FROM },
          to: [{ email: tech.email }],
          subject,
          htmlContent: html
        };
        logEvent('info', 'staffing_email.email_payload_ready');
        const sendRes = await sendBrevoEmail(BREVO_KEY, emailPayload);
        logEvent('info', 'staffing_email.brevo_response', { status: sendRes.status, ok: sendRes.ok });
        await supabase.from("staffing_events").insert({
          staffing_request_id: insertedId,
          event: "email_sent",
          meta: {
            phase,
            status: sendRes.status,
            role: roleCode,
            message: message ?? null,
            request_origin: request_origin ?? null,
            campaign_id: campaign_id ?? null,
            single_day: isSingleDayRequest || isBatch,
            target_date: normalizedTargetDate,
            dates: normalizedDates,
            conflict_warnings: conflictWarnings // Include conflict warnings in metadata for tracking
          }
        });
        if (sendRes.ok) {
          emitStaffingPush({
            channel: 'email',
            jobId: job_id,
            profileId: profile_id,
            actorId: actorId || null,
            department: staffingDepartment,
            staffingRequestId: insertedId,
            phase,
            roleCode,
            targetDate: normalizedTargetDate,
            singleDay: isSingleDayRequest || isBatch,
            requestOrigin: request_origin,
            campaignId: campaign_id,
          });
          try {
            const activityCode = phase === 'availability' ? 'staffing.availability.sent' : 'staffing.offer.sent';
            await supabase.rpc('log_activity_as', {
              _actor_id: actorId,
              _code: activityCode,
              _job_id: job_id,
              _entity_type: 'staffing',
              _entity_id: insertedId,
              _payload: { staffing_request_id: insertedId, phase, profile_id, tech_name: fullName || tech.email },
              _visibility: null,
            });
          } catch (activityError) {
            logEvent('warn', 'staffing_email.failed_to_log_activity');
          }
          return new Response(JSON.stringify({ success: true, channel: 'email' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } else {
          const errorText = await sendRes.text();
          return new Response(JSON.stringify({ error: "Email delivery failed", details: { status: sendRes.status, message: errorText } }), { status: sendRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

    } catch (operationError) {
      logEvent('error', 'staffing_email.operation_error');
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    if (error instanceof HttpError) throw error;
    logEvent('error', 'staffing_email.server_error');
    return new Response("Server error", { status: 500, headers: corsHeaders });
  }
}, { allowedMethods: ["POST"] }));
