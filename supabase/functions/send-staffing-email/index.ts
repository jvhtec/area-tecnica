import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_SECRET = Deno.env.get("STAFFING_TOKEN_SECRET")!;
// Compute confirmation base URL using the functions domain so GET is allowed
const __RAW_CONFIRM_BASE = Deno.env.get("PUBLIC_CONFIRM_BASE");
const __PROJECT_REF = (() => {
  try { return new URL(SUPABASE_URL).host.split('.')[0]; } catch { return ''; }
})();
const __FUNCTIONS_HOST = __PROJECT_REF ? `https://${__PROJECT_REF}.functions.supabase.co` : '';
const __DEFAULT_CONFIRM_BASE = __FUNCTIONS_HOST ? `${__FUNCTIONS_HOST}/staffing-click` : `${SUPABASE_URL}/functions/v1/staffing-click`;
const CONFIRM_BASE = (__RAW_CONFIRM_BASE && /staffing-click(\b|[/?#])/i.test(__RAW_CONFIRM_BASE)) ? __RAW_CONFIRM_BASE : __DEFAULT_CONFIRM_BASE;
const BREVO_KEY = Deno.env.get("BREVO_API_KEY")!;
const BREVO_FROM = Deno.env.get("BREVO_FROM")!;
// Optional branding
// Defaults use Supabase Storage for reliability in email clients
const COMPANY_LOGO_URL = Deno.env.get("COMPANY_LOGO_URL_W") || `${SUPABASE_URL}/storage/v1/object/public/company-assets/sectorlogow.png`;
const AT_LOGO_URL = Deno.env.get("AT_LOGO_URL") || `${SUPABASE_URL}/storage/v1/object/public/company-assets/area-tecnica-logo.png`;
const DAILY_CAP = parseInt(Deno.env.get("STAFFING_DAILY_CAP") ?? "100", 10);
// Company-local timezone for end-user display (email/WhatsApp)
const COMPANY_TZ = Deno.env.get('COMPANY_TZ') || 'Europe/Madrid';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function resolveActorId(supabase: ReturnType<typeof createClient>, req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      console.warn('[send-staffing-email] Unable to resolve actor id:', error);
      return null;
    }
    return data.user?.id ?? null;
  } catch (err) {
    console.warn('[send-staffing-email] Error resolving actor id', err);
    return null;
  }
}

function b64url(u8: Uint8Array) {
  return btoa(String.fromCharCode(...u8)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const actorId = await resolveActorId(supabase, req);
    const body = await req.json();
    console.log('📥 RECEIVED PAYLOAD:', JSON.stringify(body, null, 2));

    const { job_id, profile_id, phase, role, message, channel, tour_pdf_path, target_date, single_day, override_conflicts } = body;
    const datesArrayRaw: unknown = (body as any)?.dates;
    const shouldOverrideConflicts = Boolean(override_conflicts);
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
    console.log('🔍 VALIDATING FIELDS:', {
      job_id: { value: job_id, type: typeof job_id, isValid: !!job_id },
      profile_id: { value: profile_id, type: typeof profile_id, isValid: !!profile_id },
      phase: { value: phase, type: typeof phase, isValidPhase: ["availability","offer"].includes(phase) },
      role: { value: role ?? null },
      message: { value: message ?? null },
      target_date: { value: target_date ?? null, normalized: normalizedTargetDate },
      single_day: { value: single_day ?? null, effective: isSingleDayRequest },
      dates: normalizedDates
    });
    
    if (!job_id || !profile_id || !["availability","offer"].includes(phase)) {
      const errorDetails = {
        missing_job_id: !job_id,
        missing_profile_id: !profile_id,
        invalid_phase: !["availability","offer"].includes(phase),
        received: { job_id, profile_id, phase }
      };
      console.error('❌ VALIDATION FAILED:', errorDetails);
      return new Response(JSON.stringify({ error: "Bad Request", details: errorDetails }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('✅ VALIDATION PASSED - Proceeding with email send...');

    // Check required environment variables
    console.log('🔧 CHECKING ENV VARIABLES:', {
      DAILY_CAP: { value: DAILY_CAP, exists: !!DAILY_CAP },
      TOKEN_SECRET: { exists: !!TOKEN_SECRET, length: TOKEN_SECRET?.length },
      CONFIRM_BASE: { exists: !!CONFIRM_BASE, value: CONFIRM_BASE },
      BREVO_KEY: desiredChannel === 'email' ? { exists: !!BREVO_KEY, length: BREVO_KEY?.length } : { skipped: true },
      BREVO_FROM: desiredChannel === 'email' ? { exists: !!BREVO_FROM, value: BREVO_FROM } : { skipped: true }
    });

    if (!TOKEN_SECRET || !CONFIRM_BASE || (desiredChannel === 'email' && (!BREVO_KEY || !BREVO_FROM))) {
      const missingEnvs = [];
      if (!TOKEN_SECRET) missingEnvs.push('STAFFING_TOKEN_SECRET');
      if (!CONFIRM_BASE) missingEnvs.push('PUBLIC_CONFIRM_BASE');
      if (desiredChannel === 'email') {
        if (!BREVO_KEY) missingEnvs.push('BREVO_API_KEY');
        if (!BREVO_FROM) missingEnvs.push('BREVO_FROM');
      }
      
      console.error('❌ MISSING ENV VARIABLES:', missingEnvs);
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
      console.log('📊 CHECKING DAILY CAP...');
      const since = new Date(Date.now() - 24*60*60*1000).toISOString();
      const { count, error: capError } = await supabase.from("staffing_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since)
        .in("event", ["email_sent", "whatsapp_sent"]);
      
      if (capError) {
        console.error('❌ DAILY CAP CHECK ERROR:', capError);
        return new Response(JSON.stringify({ 
          error: "Database error checking daily cap", 
          details: capError 
        }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log('📊 DAILY CAP RESULT:', { count, limit: DAILY_CAP });
      if ((count ?? 0) >= DAILY_CAP) {
        console.log('⚠️ DAILY CAP REACHED');
        return new Response(JSON.stringify({ 
          error: "Daily email limit reached", 
          details: { current: count, limit: DAILY_CAP }
        }), { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Step 2: Fetch job and profile data
      console.log('🔍 FETCHING JOB AND PROFILE DATA...');
      const [jobResult, techResult, actorResult] = await Promise.all([
        supabase.from("jobs")
          .select(`
            id,
            title,
            start_time,
            end_time,
            locations(formatted_address)
          `)
          .eq("id", job_id)
          .maybeSingle(),
        supabase.from("profiles").select("id,first_name,last_name,email,phone").eq("id", profile_id).maybeSingle(),
        actorId ? supabase.from("profiles").select("waha_endpoint").eq("id", actorId).maybeSingle() : Promise.resolve({ data: null, error: null })
      ]);
      
      console.log('📋 JOB RESULT:', { data: jobResult.data, error: jobResult.error });
      console.log('👤 PROFILE RESULT:', { 
        data: techResult.data ? { ...techResult.data, email: techResult.data.email ? '***@***.***' : null } : null, 
        error: techResult.error 
      });

      if (jobResult.error) {
        console.error('❌ JOB FETCH ERROR:', jobResult.error);
        return new Response(JSON.stringify({ 
          error: "Error fetching job data", 
          details: jobResult.error 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (techResult.error) {
        console.error('❌ PROFILE FETCH ERROR:', techResult.error);
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
      
      if (!job) {
        console.error('❌ JOB NOT FOUND:', job_id);
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
        console.error('❌ PROFILE NOT FOUND OR NO EMAIL:', { profile_id, has_email: !!tech?.email });
        return new Response(JSON.stringify({ 
          error: "Profile not found or no email address", 
          details: { profile_id, has_profile: !!tech, has_email: !!tech?.email }
        }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (desiredChannel === 'whatsapp' && !tech?.phone) {
        console.error('❌ PROFILE HAS NO PHONE FOR WHATSAPP:', { profile_id });
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
        console.error('❌ ACTOR NOT AUTHORIZED FOR WHATSAPP:', { actorId });
        return new Response(JSON.stringify({ 
          error: "User not authorized for WhatsApp operations", 
          details: { actor_id: actorId }
        }), { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const fullName = `${tech.first_name || ''} ${tech.last_name || ''}`.trim();
      console.log('👤 TECH INFO:', { fullName, email: '***@***.***' });

      // Step 2b: Enhanced conflict check using RPC function
      // Checks for both hard conflicts (confirmed) and soft conflicts (pending)
      // Changed to warning-only mode: conflicts are logged but don't block sending
      // This allows different departments to start at different times without false positives
      const conflictWarnings: any[] = [];
      if (shouldOverrideConflicts) {
        console.log('⚠️ CONFLICT CHECK OVERRIDDEN by user - skipping conflict detection');
      } else {
        try {
          console.log('🕒 CONFLICT CHECK: using enhanced RPC conflict checker (warning mode)...');

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
              console.warn('⚠️ Conflict check failed, continuing to send email:', conflictErr);
            } else if (conflictResult && (conflictResult.hasHardConflict || conflictResult.hasSoftConflict)) {
              const hasJobConflicts = (conflictResult.hardConflicts?.length > 0) || (conflictResult.softConflicts?.length > 0);
              const hasUnavailability = conflictResult.unavailabilityConflicts?.length > 0;

              const conflictType = conflictResult.hasHardConflict ? 'confirmed' : 'pending';
              const conflicts = conflictResult.hasHardConflict
                ? conflictResult.hardConflicts
                : conflictResult.softConflicts;

              console.log(`⚠️ ${conflictType} conflict detected (warning only - not blocking):`, {
                jobConflicts: conflicts,
                unavailability: conflictResult.unavailabilityConflicts,
                note: 'Different departments may start at different times, so whole job span conflicts are treated as warnings'
              });

              // Accumulate conflict warnings for metadata logging (don't overwrite)
              conflictWarnings.push({
                conflict_type: conflictType,
                conflicts: conflicts,
                unavailability: conflictResult.unavailabilityConflicts,
                target_date: dateToCheck
              });
            }
          }

          if (conflictWarnings.length > 0) {
            console.log('⚠️ Conflicts detected but allowing send to proceed - conflicts logged as warnings');
          } else {
            console.log('✅ No conflicts detected, proceeding to send email');
          }
        } catch (conflictCheckErr) {
          console.warn('⚠️ Conflict check encountered an error, continuing to send email:', conflictCheckErr);
        }
      }

      // Step 2c: Hard block for actual timesheet conflicts on specific dates
      // CRITICAL: This check is NOT overridable - prevents real double-bookings
      // Runs regardless of shouldOverrideConflicts flag
      try {
        console.log('🕒 TIMESHEET CHECK: verifying no double-booking on exact dates...');

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
          console.log(`📅 Whole-span request detected, checking ${dates.length} dates from job span`);
        }

        if (datesToCheck.length > 0) {
          // Check if technician already has timesheets for these exact dates
          const { data: existingTimesheets, error: timesheetErr } = await supabase
            .from('timesheets')
            .select('date, job_id, jobs(title)')
            .eq('technician_id', profile_id)
            .in('date', datesToCheck)
            .neq('job_id', job_id);

          if (timesheetErr) {
            console.warn('⚠️ Timesheet check failed, continuing:', timesheetErr);
          } else if (existingTimesheets && existingTimesheets.length > 0) {
            // Found actual timesheet conflicts - this is a real double-booking
            const conflictDates = existingTimesheets.map(ts => ({
              date: ts.date,
              job_title: (ts.jobs as any)?.title || 'Unknown Job'
            }));

            console.log('⛔ HARD CONFLICT: Timesheet already exists for exact dates:', conflictDates);

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
            console.log('✅ No timesheet conflicts on exact dates');
          }
        }
      } catch (timesheetCheckErr) {
        console.warn('⚠️ Timesheet check encountered an error, continuing:', timesheetCheckErr);
      }

      // Step 3: Generate token
      console.log('🔐 GENERATING TOKEN...');
      const rid = crypto.randomUUID();
      const exp = new Date(Date.now() + 1000*60*60*48).toISOString();
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(TOKEN_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key,
        new TextEncoder().encode(`${rid}:${phase}:${exp}`)));
      const token = b64url(sig);

      // Store only hash of token bytes
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", sig));
      const token_hash = Array.from(digest).map(x=>x.toString(16).padStart(2,'0')).join('');
      console.log('🔐 TOKEN GENERATED:', { rid, expires: exp });

      // Step 4: Insert/update staffing request(s)
      console.log('💾 SAVING STAFFING REQUEST...');
      let insertedId = rid;
      // If multiple dates are provided, create a batch of single-day requests and use one of them for the email link
      const isBatch = normalizedDates.length > 1;
      let batchId: string | null = null;
      if (isBatch) {
        batchId = crypto.randomUUID();
        // Choose the first date to own the clickable rid
        const firstDate = normalizedDates[0];
        const firstInsert = await supabase.from('staffing_requests').insert({
          id: rid,
          job_id,
          profile_id,
          phase,
          status: 'pending',
          token_hash,
          token_expires_at: exp,
          single_day: true,
          target_date: firstDate,
          batch_id: batchId,
        });
        if (firstInsert.error) {
          console.error('❌ STAFFING REQUEST BATCH FIRST INSERT ERROR:', firstInsert.error);
          return new Response(JSON.stringify({ error: 'Database error saving first batch request', details: firstInsert.error }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // Insert remaining dates with upsert to avoid duplicates
        const rest = normalizedDates.slice(1).map(d => ({
          job_id,
          profile_id,
          phase,
          status: 'pending',
          token_hash, // placeholder; not used for click on these rows
          token_expires_at: exp,
          single_day: true,
          target_date: d,
          batch_id: batchId,
        }));
        if (rest.length) {
          const up = await supabase
            .from('staffing_requests')
            .upsert(rest, { onConflict: 'job_id,profile_id,phase,target_date' });
          if (up.error) {
            console.warn('⚠️ Batch upsert had errors:', up.error);
          }
        }
      } else {
        // Single request as before
        const insertRes = await supabase.from("staffing_requests").insert({
          id: rid,
          job_id,
          profile_id,
          phase,
          status: "pending",
          token_hash,
          token_expires_at: exp,
          single_day: isSingleDayRequest,
          target_date: normalizedTargetDate,
        });
        if (insertRes.error && insertRes.error.code === "23505") {
          console.log('🔄 DUPLICATE FOUND, UPDATING...');
          // Target the exact pending row shape to avoid touching unrelated requests
          let updater = supabase
            .from("staffing_requests")
            .update({
              token_hash,
              token_expires_at: exp,
              updated_at: new Date().toISOString(),
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
          console.log('🔄 UPDATE RESULT:', { data: upd.data, error: upd.error });
          if (upd.data?.id) insertedId = upd.data.id;
        } else if (insertRes.error) {
          console.error('❌ STAFFING REQUEST INSERT ERROR:', insertRes.error);
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
        console.warn('[send-staffing-email] Failed to sign tour_pdf_path', e);
      }

      // Step 5: Build content (email or whatsapp)
      console.log('📧 BUILDING EMAIL CONTENT...');
      const confirmUrl = `${CONFIRM_BASE}?rid=${encodeURIComponent(insertedId)}&a=confirm&exp=${encodeURIComponent(exp)}&t=${token}&c=${encodeURIComponent(desiredChannel)}`;
      const declineUrl = `${CONFIRM_BASE}?rid=${encodeURIComponent(insertedId)}&a=decline&exp=${encodeURIComponent(exp)}&t=${token}&c=${encodeURIComponent(desiredChannel)}`;

      const roleLabel = labelForRoleCode(role) || null;
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
      const loc = job.locations?.formatted_address ?? 'Por confirmar';

      const safeMessage = (message ?? '').replace(/</g, '&lt;').replace(/\n/g, '<br/>');

      const primaryCta = phase === 'availability' ? 'Estoy disponible' : 'Acepto la oferta';
      const secondaryCta = phase === 'availability' ? 'No estoy disponible' : 'Rechazo la oferta';
      // Build date row depending on single-day vs span
      const datesRowHtml = (isSingleDayRequest && targetDateLabel)
        ? `<div><b>Fecha:</b> ${targetDateLabel}</div>`
        : `<div><b>Fechas:</b> ${startDate}${job.end_time ? ` — ${endDate}` : ''}</div>`;

      const multiDatesHtml = normalizedDates.length > 1
        ? `<div><b>Fechas seleccionadas:</b></div><ul style="margin:8px 0 0 16px;padding:0;">${normalizedDates.map(d => `<li>${fmtDate(`${d}T00:00:00Z`)}</li>`).join('')}</ul>`
        : '';

      // Determine singular vs plural for availability message
      const isMultipleDates = normalizedDates.length > 1;
      const datePhrasing = isMultipleDates ? 'las fechas indicadas más abajo' : 'la fecha indicada más abajo';
      const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${subject}</title>
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
                            <img src="${COMPANY_LOGO_URL}" alt="Sector Pro" height="36" style="display:block;border:0;max-height:36px" />
                          </a>
                        </td>
                        <td align="right" style="vertical-align:middle;">
                          <a href="https://sector-pro.work" target="_blank" rel="noopener noreferrer">
                            <img src="${AT_LOGO_URL}" alt="Área Técnica" height="36" style="display:block;border:0;max-height:36px" />
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 24px 8px 24px;">
                    <h2 style="margin:0 0 8px 0;font-size:20px;color:#111827;">Hola ${fullName || ''},</h2>
                    <p style="margin:0;color:#374151;line-height:1.55;">
                      ${phase === 'availability'
                        ? `¿Tendrías disponibilidad para ${datePhrasing}?`
                        : `Tienes una oferta para <b>${job.title}</b>. Por favor, confirma:`}
                    </p>
                    ${phase === 'availability'
                      ? `<p style="margin:12px 0 0 0;color:#374151;line-height:1.55;"><b>ATENCIÓN:</b> Este email SOLO confirma disponibilidad, no te cierra el evento.<br/>Si confirmas, recibirás un segundo email con la oferta de trabajo detallada.</p>`
                      : ''}
                    ${phase === 'offer' && roleLabel ? `<p style="margin:8px 0 0 0;color:#111827;"><b>Puesto:</b> ${roleLabel}</p>` : ''}
                    ${phase === 'offer' && message ? `<p style="margin:12px 0 0 0;color:#374151;">${safeMessage}</p>` : ''}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 24px 0 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
                      <tr>
                        <td style="padding:16px;">
                          <div style="color:#111827;font-weight:bold;margin-bottom:4px;">Detalles del trabajo</div>
                          <div style="color:#374151;line-height:1.55;">
                            ${normalizedDates.length > 1 ? multiDatesHtml : datesRowHtml}
                            <div><b>Horario:</b> ${callTime}</div>
                            <div><b>Ubicación:</b> ${loc}</div>
                            ${roleLabel ? `<div><b>Rol:</b> ${roleLabel}</div>` : ''}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${tourPdfSignedUrl ? `
                <tr>
                  <td style="padding:12px 24px 0 24px;">
                    <div style=\"background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;\">
                      <div style=\"font-weight:600;color:#9a3412;margin-bottom:4px;\">Calendario del tour (PDF)</div>
                      <a href=\"${tourPdfSignedUrl}\" style=\"color:#9a3412;text-decoration:underline;\">Descargar PDF</a>
                    </div>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding:16px 24px 24px 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;">
                      <tr>
                        <td align="left" style="padding:8px 0;">
                          <a href="${confirmUrl}" style="display:inline-block;background:#10b981;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">${primaryCta}</a>
                        </td>
                        <td align="right" style="padding:8px 0;">
                          <a href="${declineUrl}" style="display:inline-block;background:#ef4444;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">${secondaryCta}</a>
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
      console.log('🔗 CONFIRM LINKS:', { confirmUrl, declineUrl });
      if (desiredChannel === 'whatsapp') {
        // Build WhatsApp text (plain)
        const lines: string[] = [];
        lines.push(`Hola ${fullName || ''},`);
        if (phase === 'availability') {
          lines.push(`¿Tendrías disponibilidad para ${datePhrasing}?`);
          lines.push('');
          lines.push('ATENCIÓN: Este email SOLO confirma disponibilidad, no te cierra el evento.');
          lines.push('Si confirmas, recibirás un segundo email con la oferta de trabajo detallada.');
        } else {
          lines.push(`Tienes una oferta para ${job.title}.`);
          if (roleLabel) lines.push(`Puesto: ${roleLabel}`);
        }
        lines.push('');
        lines.push('Detalles del trabajo:');
        if (normalizedDates.length > 1) {
          lines.push('- Fechas seleccionadas:');
          normalizedDates.forEach(d => lines.push(`  • ${fmtDate(`${d}T00:00:00Z`)}`));
        } else if (isSingleDayRequest && targetDateLabel) {
          lines.push(`- Fecha: ${targetDateLabel}`);
        } else {
          lines.push(`- Fechas: ${startDate}${job.end_time ? ` — ${endDate}` : ''}`);
        }
        lines.push(`- Horario: ${callTime}`);
        lines.push(`- Ubicación: ${loc}`);
        if (roleLabel) lines.push(`- Rol: ${roleLabel}`);
        if (phase === 'offer' && (message ?? '').trim()) {
          lines.push('');
          lines.push((message as string).trim());
        }
        lines.push('');
        if (tourPdfSignedUrl) {
          lines.push(`Calendario del tour (PDF): ${tourPdfSignedUrl}`);
          lines.push('');
        }
        lines.push(`Confirmar: ${confirmUrl}`);
        lines.push(`No estoy disponible: ${declineUrl}`);
        const text = lines.join('\n');

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
          console.log('[send-staffing-email] WA context', {
            requestId,
            actorId,
            base,
            session,
            hasApiKey: Boolean(apiKey),
            chatIdSuffix: (tech.phone || '').slice(-4),
          });
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
        const attempts = [
          { url: `${base}/api/${encodeURIComponent(session)}/sendText`, body: { ...basePayload } },
          { url: `${base}/api/sendText`, body: { ...basePayload, session } },
        ] as const;

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
              console.warn('[send-staffing-email] WAHA non-OK', { url: attempt.url, status: res.status, rayId: cf?.rayId || null });
              attemptErrors.push({ url: attempt.url, step: 'http', status: res.status, body: truncate(bodyStr), cloudflareRayId: cf?.rayId || null });
              continue;
            }
            const interpretation = interpretResponse(parsed);
            if (interpretation.ok) { waOk = true; break; }
            const serialized = parsed ? JSON.stringify(parsed) : textBody || '';
            console.warn('[send-staffing-email] WAHA reported failure', { url: attempt.url, reason: interpretation.reason || null });
            attemptErrors.push({ url: attempt.url, step: 'api', status: res.status, json: parsed, body: truncate(serialized), message: interpretation.reason });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.warn('[send-staffing-email] WAHA fetch error', { url: attempt.url, message });
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
            role: role ?? null,
            single_day: isSingleDayRequest || isBatch,
            target_date: normalizedTargetDate,
            dates: normalizedDates,
            conflict_warnings: conflictWarnings // Include conflict warnings in metadata for tracking
          }
        });

        if (waOk) {
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
            console.warn('[send-staffing-email] Failed to log activity (whatsapp)', activityError);
          }
          return new Response(JSON.stringify({ success: true, channel: 'whatsapp' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const errorPayload = { error: 'WhatsApp delivery failed', request_id: requestId, context: { base, session, chatIdSuffix: (tech.phone || '').slice(-4) }, attempts: attemptErrors };
        const statusToReturn = typeof lastStatus === 'number' && lastStatus >= 400 ? lastStatus : 502;
        return new Response(JSON.stringify(errorPayload), { status: statusToReturn, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else {
        // Email channel via Brevo
        console.log('📤 SENDING EMAIL VIA BREVO...');
        const emailPayload = {
          sender: { email: BREVO_FROM },
          to: [{ email: tech.email }],
          subject,
          htmlContent: html
        };
        console.log('📤 EMAIL PAYLOAD:', { sender: emailPayload.sender, to: [{ email: '***@***.***' }], subject: emailPayload.subject });
        const sendRes = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" }, body: JSON.stringify(emailPayload) });
        console.log('📤 BREVO RESPONSE:', { status: sendRes.status, statusText: sendRes.statusText, ok: sendRes.ok });
        await supabase.from("staffing_events").insert({
          staffing_request_id: insertedId,
          event: "email_sent",
          meta: {
            phase,
            status: sendRes.status,
            role: role ?? null,
            message: message ?? null,
            single_day: isSingleDayRequest || isBatch,
            target_date: normalizedTargetDate,
            dates: normalizedDates,
            conflict_warnings: conflictWarnings // Include conflict warnings in metadata for tracking
          }
        });
        if (sendRes.ok) {
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
            console.warn('[send-staffing-email] Failed to log activity', activityError);
          }
          return new Response(JSON.stringify({ success: true, channel: 'email' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } else {
          const errorText = await sendRes.text();
          return new Response(JSON.stringify({ error: "Email delivery failed", details: { status: sendRes.status, message: errorText } }), { status: sendRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

    } catch (operationError) {
      console.error('❌ OPERATION ERROR:', operationError);
      return new Response(JSON.stringify({ 
        error: "Internal server error", 
        details: { message: operationError.message, stack: operationError.stack }
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error("Server error:", error);
    return new Response("Server error", { status: 500, headers: corsHeaders });
  }
});
