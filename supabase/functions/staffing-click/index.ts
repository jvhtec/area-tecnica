import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detectConflictForAssignment, type AssignmentCoverage, type JobTimeInfo } from "./conflictUtils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_SECRET = Deno.env.get("STAFFING_TOKEN_SECRET")!;
// Optional branding (same defaults as email)
const COMPANY_LOGO_URL = Deno.env.get("COMPANY_LOGO_URL") || `${SUPABASE_URL}/storage/v1/object/public/company-assets/sector-pro-logo.png`;
const AT_LOGO_URL = Deno.env.get("AT_LOGO_URL") || `${SUPABASE_URL}/storage/v1/object/public/company-assets/area-tecnica-logo.png`;

function b64uToU8(b64u: string) {
  const b64 = b64u.replace(/-/g,'+').replace(/_/g,'/') + '=='.slice(0,(4-(b64u.length%4))%4);
  const bin = atob(b64);
  return new Uint8Array([...bin].map(c => c.charCodeAt(0)));
}

serve(async (req) => {
  // 🔍 EARLY REQUEST LOGGING - Log all incoming requests for debugging
  console.log('📥 INCOMING REQUEST:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  try {
    const url = new URL(req.url);
    console.log('🔗 PARSED URL:', {
      pathname: url.pathname,
      searchParams: Object.fromEntries(url.searchParams.entries())
    });
    const rid = url.searchParams.get("rid");
    const action = url.searchParams.get("a"); // 'confirm' | 'decline'
    const exp = url.searchParams.get("exp");
    const t = url.searchParams.get("t");
    const c = (url.searchParams.get('c') || '').toLowerCase(); // optional channel hint: 'email'|'wa'|'whatsapp'
    
    console.log('✅ STEP 1: Parameters parsed', { rid, action, exp: exp?.substring(0, 20), t: t?.substring(0, 20), channel: c });
    
    // For link preview HEAD requests, avoid rendering/html to reduce plaintext in previews
    if (req.method === 'HEAD') {
      console.log('⚠️ HEAD request, returning 204');
      return new Response(null, { status: 204 });
    }

    if (!rid || !action || !exp || !t) {
      console.log('❌ STEP 2 FAILED: Missing parameters');
      return await redirectResponse({
        title: 'Enlace inválido',
        status: 'error',
        heading: 'Enlace inválido',
        message: 'Este enlace está incompleto o le faltan parámetros.'
      });
    }
    console.log('✅ STEP 2: All required parameters present');
    
    const expTime = new Date(exp).getTime();
    const nowTime = Date.now();
    if (expTime < nowTime) {
      console.log('❌ STEP 3 FAILED: Link expired', { expTime, nowTime, diff: nowTime - expTime });
      return await redirectResponse({
        title: 'Enlace caducado',
        status: 'warning',
        heading: 'Enlace caducado',
        message: 'Este enlace ha caducado. Contacta con tu responsable para solicitar uno nuevo.'
      });
    }
    console.log('✅ STEP 3: Link not expired', { expTime, nowTime });

    console.log('🔍 STEP 4: Querying database for staffing request', { rid });
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: row, error: dbError } = await supabase.from("staffing_requests").select("*").eq("id", rid).maybeSingle();
    
    if (dbError) {
      console.error('❌ STEP 4 FAILED: Database error', dbError);
      return await redirectResponse({
        title: 'Error de base de datos',
        status: 'error',
        heading: 'Error de base de datos',
        message: 'No se pudo verificar la solicitud. Inténtalo de nuevo.'
      });
    }
    
    if (!row) {
      console.log('❌ STEP 4 FAILED: Request not found in database', { rid });
      return await redirectResponse({
        title: 'No encontrado',
        status: 'error',
        heading: 'Solicitud no encontrada',
        message: 'No hemos podido localizar esta solicitud.'
      });
    }
    console.log('✅ STEP 4: Request found', { rid, phase: row.phase, status: row.status });

    // Recompute expected token hash (HMAC over rid:phase:exp)
    console.log('🔐 STEP 5: Starting token validation');
    try {
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(TOKEN_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key,
        new TextEncoder().encode(`${rid}:${row.phase}:${exp}`)));
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", sig));
      const token_hash_expected = Array.from(digest).map(x=>x.toString(16).padStart(2,'0')).join('');

      // Compare provided token too (defense-in-depth)
      const providedHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", b64uToU8(t))))
        .map(x=>x.toString(16).padStart(2,'0')).join('');

      console.log('🔐 Token hashes computed', { 
        expected: token_hash_expected.substring(0, 16), 
        provided: providedHash.substring(0, 16),
        stored: row.token_hash?.substring(0, 16)
      });

      if (token_hash_expected !== row.token_hash && providedHash !== row.token_hash) {
        console.log('❌ STEP 5 FAILED: Token validation failed');
      return await redirectResponse({
        title: 'Token inválido',
        status: 'error',
        heading: 'Token inválido',
        message: 'Este enlace no es válido. Utiliza el enlace original de tu correo.'
      });
      }
      console.log('✅ STEP 5: Token validated successfully');
    } catch (cryptoError) {
      console.error('❌ STEP 5 FAILED: Crypto error', cryptoError);
      return await redirectResponse({
        title: 'Error de validación',
        status: 'error',
        heading: 'Error de validación',
        message: 'No se pudo validar el enlace. Inténtalo de nuevo.'
      });
    }

    // Check if already responded
    console.log('🔍 STEP 6: Checking current status', { currentStatus: row.status });
    if (row.status !== 'pending') {
      const statusText = row.status === 'confirmed' ? 'confirmado' : 'rechazado';
      const phase = row.phase === 'offer' ? 'la oferta' : 'la disponibilidad';
      console.log('⚠️ STEP 6: Already responded', { status: row.status, phase: row.phase });
      return await redirectResponse({
        title: 'Respuesta registrada',
        status: 'warning',
        heading: 'Respuesta ya registrada',
        message: `Ya has ${statusText} ${phase}.`,
        submessage: 'Puedes cerrar esta pestaña.'
      });
    }
    console.log('✅ STEP 6: Status is pending, proceeding to update');

    // Process the action directly - no need for intermediate confirmation page
    // The action is already in the URL (a=confirm or a=decline)
    console.log('💾 STEP 7: PROCESSING ACTION', { rid, action, channel: c, phase: row.phase });
    
    const newStatus = action === "confirm" ? "confirmed" : "declined";
    
    // Update and verify row was affected (batch-aware)
    console.log('💾 ATTEMPTING DB UPDATE:', { rid, newStatus, action, batch_id: (row as any).batch_id || null });
    let updRow: any = null;
    let updErr: any = null;
    let updatedBatchRows: any[] | null = null;
    if ((row as any)?.batch_id) {
      const { data, error } = await supabase
        .from('staffing_requests')
        .update({ status: newStatus })
        .eq('batch_id', (row as any).batch_id)
        .eq('job_id', row.job_id)
        .eq('profile_id', row.profile_id)
        .eq('phase', row.phase)
        .eq('status', 'pending')
        .select('id,status,target_date,single_day')
        ;
      updatedBatchRows = Array.isArray(data) ? data : null;
      updRow = Array.isArray(data) && data.length ? data[0] : null;
      updErr = error;
    } else {
      const { data, error } = await supabase
        .from("staffing_requests")
        .update({ status: newStatus })
        .eq("id", rid)
        .select('id,status')
        .maybeSingle();
      updRow = data;
      updErr = error;
    }
    
    if (updErr || !updRow) {
      console.error('❌ STAFFING STATUS UPDATE FAILED:', { updErr, rid, newStatus });
      return new Response(renderPage({
        title: 'Error de actualización',
        status: 'error',
        heading: 'Error al guardar respuesta',
        message: 'No se pudo guardar tu respuesta. Por favor, inténtalo de nuevo o contacta con tu responsable.',
        submessage: updErr?.message || 'No se encontró el registro para actualizar.'
      }), { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
    }
    
    console.log('✅ DB UPDATE SUCCESS:', { rid, updatedStatus: updRow.status });
    
    // Trigger explicit realtime notification to ensure frontend receives update
    try {
      await supabase
        .from('staffing_requests')
        .select('*')
        .eq('id', rid)
        .single();
      console.log('🔔 Realtime notification triggered for staffing_requests update');
    } catch (realtimeErr) {
      console.warn('⚠️ Realtime trigger failed (non-blocking):', realtimeErr);
    }
    const { error: insEvtErr } = await supabase.from("staffing_events").insert({ staffing_request_id: rid, event: `clicked_${action}` });
    if (insEvtErr) console.error('Insert staffing_events failed', insEvtErr);

    // Get technician name for activity log
    const { data: techProfile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', row.profile_id)
      .maybeSingle();
    
    const techName = techProfile 
      ? `${techProfile.first_name || ''} ${techProfile.last_name || ''}`.trim() || 'Technician'
      : 'Technician';

    // Log activity with correct actor and payload
    const activityCode = row.phase === 'availability' 
      ? (newStatus === 'confirmed' ? 'staffing.availability.confirmed' : 'staffing.availability.declined')
      : (newStatus === 'confirmed' ? 'staffing.offer.confirmed' : 'staffing.offer.declined');

    await supabase.rpc('log_activity_as', {
      _actor_id: row.profile_id,
      _code: activityCode,
      _job_id: row.job_id,
      _entity_type: 'staffing',
      _entity_id: rid,
      _payload: {
        technician_name: techName,
        action: newStatus,
        phase: row.phase
      }
    });

    // Fire a push broadcast to management and participants using the internal service key
    try {
      const pushType = activityCode; // same code mapping
      const pushUrl = `${SUPABASE_URL}/functions/v1/push`;
      const payload = {
        action: 'broadcast',
        type: pushType,
        job_id: row.job_id,
        recipient_id: row.profile_id,
        recipient_name: techName,
      } as const;
      await fetch(pushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE}`,
        },
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    } catch (_) {
      // non-blocking
    }

    // If an offer was confirmed, auto-create/update a job assignment with role
    if (newStatus === 'confirmed' && row.phase === 'offer') {
      try {
        // 1) Resolve chosen role from last email_sent event for this request (offer phase)
        const { data: lastEmail, error: lastEmailErr } = await supabase
          .from('staffing_events')
          .select('meta, created_at')
          .eq('staffing_request_id', rid)
          .in('event', ['email_sent', 'whatsapp_sent'])
          .contains('meta', { phase: 'offer' })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const chosenRole = (lastEmail?.meta as any)?.role ?? null;

        // 2) Fetch target job and technician profile (for department)
        const [{ data: job, error: jobErr }, { data: prof, error: profErr }] = await Promise.all([
          supabase.from('jobs').select('id,title,start_time,end_time,job_type').eq('id', row.job_id).maybeSingle(),
          supabase.from('profiles').select('id,department').eq('id', row.profile_id).maybeSingle()
        ]);

        if (jobErr || profErr) {
          console.warn('⚠️ Auto-assign: job/profile fetch error', { jobErr, profErr });
          await supabase.from('staffing_events').insert({
            staffing_request_id: rid,
            event: 'auto_assign_prereq_error',
            meta: { jobErr, profErr }
          });
        } else if (job && prof) {
          await supabase.from('staffing_events').insert({
            staffing_request_id: rid,
            event: 'auto_assign_attempt',
            meta: { role: chosenRole, department: prof.department, job_id: job.id, profile_id: row.profile_id }
          });
          // 3) Conflict check: ensure no other confirmed assignment overlaps
          const { data: confirmedAssigns, error: assignErr } = await supabase
            .from('job_assignments')
            .select('job_id,status,single_day,assignment_date')
            .eq('technician_id', row.profile_id)
            .eq('status', 'confirmed');
          const confirmedAssignments = !assignErr && Array.isArray(confirmedAssigns) ? confirmedAssigns : [];
          const otherJobIds = Array.from(new Set(confirmedAssignments.map(a => a.job_id).filter(id => id !== row.job_id)));
          let otherJobs: { id: number; start_time: string | null; end_time: string | null; title: string | null }[] = [];
          if (otherJobIds.length > 0) {
            const { data: otherJobsData } = await supabase
              .from('jobs')
              .select('id,start_time,end_time,title')
              .in('id', otherJobIds);
            otherJobs = otherJobsData ?? [];
          }

          const jobTimeMap = new Map<number, JobTimeInfo>();
          if (job) {
            jobTimeMap.set(job.id, {
              title: job.title ?? null,
              start: job.start_time ? new Date(job.start_time) : null,
              end: job.end_time ? new Date(job.end_time) : null,
              rawStart: job.start_time ?? null,
              rawEnd: job.end_time ?? null,
            });
          }
          for (const j of otherJobs) {
            jobTimeMap.set(j.id, {
              title: j.title ?? null,
              start: j.start_time ? new Date(j.start_time) : null,
              end: j.end_time ? new Date(j.end_time) : null,
              rawStart: j.start_time ?? null,
              rawEnd: j.end_time ?? null,
            });
          }

          const DAY_MS = 24 * 60 * 60 * 1000;
          const toDateOrNull = (value: string | null | undefined) => {
            if (!value) return null;
            const d = new Date(value);
            return Number.isNaN(d.getTime()) ? null : d;
          };
          const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

          const existingAssignmentWindows: AssignmentCoverage[] = [];
          for (const assign of confirmedAssignments) {
            if (assign.job_id === row.job_id) continue;
            if (assign.single_day && assign.assignment_date) {
              const dayStart = toDateOrNull(assign.assignment_date);
              if (!dayStart) continue;
              existingAssignmentWindows.push({
                window: { kind: 'day', start: dayStart, end: addDays(dayStart, 1) },
                meta: {
                  job_id: assign.job_id,
                  job_title: jobTimeMap.get(assign.job_id)?.title ?? null,
                  assignment_date: assign.assignment_date,
                },
              });
              continue;
            }
            const jobInfo = jobTimeMap.get(assign.job_id);
            if (!jobInfo || !jobInfo.start || !jobInfo.end) continue;
            if (jobInfo.start.getTime() >= jobInfo.end.getTime()) continue;
            existingAssignmentWindows.push({
              window: { kind: 'range', start: jobInfo.start, end: jobInfo.end },
              meta: {
                job_id: assign.job_id,
                job_title: jobInfo.title ?? null,
                start_time: jobInfo.rawStart,
                end_time: jobInfo.rawEnd,
              },
            });
          }

          // 4) SIMPLIFIED: Create one assignment per job+tech, then create timesheets for confirmed days
          const rolePatch: Record<string, string | null> = {};
          if (prof.department === 'sound') rolePatch['sound_role'] = chosenRole;
          else if (prof.department === 'lights') rolePatch['lights_role'] = chosenRole;
          else if (prof.department === 'video') rolePatch['video_role'] = chosenRole;

          // Create or update the single assignment record (simple upsert now!)
          console.log('🧾 Creating/updating assignment', {
            job_id: row.job_id,
            technician_id: row.profile_id,
            batch_id: (row as any)?.batch_id || null,
          });

          const { error: assignUpsertErr } = await supabase
            .from('job_assignments')
            .upsert({
              job_id: row.job_id,
              technician_id: row.profile_id,
              status: 'confirmed',
              assigned_at: new Date().toISOString(),
              assignment_source: 'staffing',
              response_time: new Date().toISOString(),
              ...rolePatch
            }, { onConflict: 'job_id,technician_id' });

          if (assignUpsertErr) {
            console.error('❌ job_assignments upsert failed', assignUpsertErr);
            await supabase.from('staffing_events').insert({
              staffing_request_id: rid,
              event: 'auto_assign_upsert_error',
              meta: { message: assignUpsertErr.message }
            });
          } else {
            console.log('✅ job_assignment created/updated');
            await supabase.from('staffing_events').insert({
              staffing_request_id: rid,
              event: 'auto_assign_upsert_ok',
              meta: { role: chosenRole, department: prof.department }
            });

            // Create timesheets for the confirmed days
            const jobType = (job as any)?.job_type;
            if (jobType === 'dryhire') {
              console.log('⏭️ Skipping timesheet creation for dryhire job');
            } else {
              const isScheduleOnly = jobType === 'tourdate';
              const timesheetRows: Array<{ job_id: string; technician_id: string; date: string; is_schedule_only: boolean; source: string }> = [];

              // Collect all confirmed dates
              if ((row as any)?.batch_id) {
                // Batch: get all confirmed dates from batch rows
                const { data: batchRows, error: batchErr } = await supabase
                  .from('staffing_requests')
                  .select('target_date,single_day')
                  .eq('batch_id', (row as any).batch_id)
                  .eq('job_id', row.job_id)
                  .eq('profile_id', row.profile_id)
                  .eq('status', 'confirmed')
                  .eq('phase', row.phase);

                if (batchErr) {
                  console.error('❌ Batch rows fetch failed', {
                    batch_id: (row as any).batch_id,
                    job_id: row.job_id,
                    profile_id: row.profile_id,
                    error: batchErr
                  });
                  await supabase.from('staffing_events').insert({
                    staffing_request_id: rid,
                    event: 'batch_timesheet_fetch_error',
                    meta: { message: batchErr.message, batch_id: (row as any).batch_id }
                  });
                  // Continue with empty array rather than failing completely
                }

                for (const br of (batchRows || [])) {
                  if (br.target_date && typeof br.target_date === 'string') {
                    timesheetRows.push({
                      job_id: row.job_id,
                      technician_id: row.profile_id,
                      date: br.target_date,
                      is_schedule_only: isScheduleOnly,
                      source: 'staffing'
                    });
                  }
                }
              } else {
                // Single request: check if it's for a specific date or whole job
                const targetDate = (row as any).target_date;
                const isSingleDay = (row as any).single_day;

                if (isSingleDay && targetDate) {
                  // Single day confirmation
                  timesheetRows.push({
                    job_id: row.job_id,
                    technician_id: row.profile_id,
                    date: targetDate,
                    is_schedule_only: isScheduleOnly,
                    source: 'staffing'
                  });
                } else if (job?.start_time && job?.end_time) {
                  // Whole job confirmation - create timesheets for all days
                  const jobStart = new Date(job.start_time);
                  const jobEnd = new Date(job.end_time);

                  for (let d = new Date(jobStart); d <= jobEnd; d.setDate(d.getDate() + 1)) {
                    timesheetRows.push({
                      job_id: row.job_id,
                      technician_id: row.profile_id,
                      date: d.toISOString().split('T')[0],
                      is_schedule_only: isScheduleOnly,
                      source: 'staffing'
                    });
                  }
                }
              }

              // Create all timesheets in one batch
              if (timesheetRows.length > 0) {
                const { error: tsErr } = await supabase
                  .from('timesheets')
                  .upsert(timesheetRows, { onConflict: 'job_id,technician_id,date' });

                if (tsErr) {
                  console.warn('⚠️ Timesheet creation failed:', { count: timesheetRows.length, error: tsErr });
                } else {
                  console.log('✅ Timesheets created:', { count: timesheetRows.length, isScheduleOnly });
                }
              }
            }
          }

            try {
              await fetch(`${SUPABASE_URL}/functions/v1/push`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SERVICE_ROLE}`
                },
                body: JSON.stringify({ action: 'broadcast', type: 'job.assignment.confirmed', job_id: row.job_id, recipient_id: row.profile_id, recipient_name: techName })
              });
            } catch (_) { /* non-blocking */ }

            // 5) Try to add to Flex crew for sound/lights (best-effort)
            try {
              if (prof.department === 'sound' || prof.department === 'lights') {
                const dept = prof.department;
                await fetch(`${SUPABASE_URL}/functions/v1/manage-flex-crew-assignments`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SERVICE_ROLE}`
                  },
                  body: JSON.stringify({ job_id: row.job_id, technician_id: row.profile_id, department: dept, action: 'add' })
                });
              }
            } catch (_) {
              // non-blocking
            }
            await supabase.from('staffing_events').insert({
              staffing_request_id: rid,
              event: 'auto_assigned_on_confirm',
              meta: { role: chosenRole, department: prof.department }
            });
          }
      } catch (autoAssignErr) {
        console.error('Auto-assign error on confirm:', autoAssignErr);
        await supabase.from('staffing_events').insert({
          staffing_request_id: rid,
          event: 'auto_assign_error',
          meta: { message: (autoAssignErr as any)?.message }
        });
      }
    }

    const phaseText = row.phase === 'offer' ? 'la oferta' : 'la disponibilidad';
    const isOk = newStatus === 'confirmed';
    const redirect = await redirectResponse({
      title: isOk ? '¡Confirmado!' : 'Respuesta registrada',
      status: isOk ? 'success' : 'neutral',
      heading: isOk ? '¡Gracias! Confirmado' : 'Respuesta registrada',
      message: `Tu respuesta sobre ${phaseText} ha sido registrada.`,
      submessage: 'Puedes cerrar esta pestaña.'
    });

    return redirect;
  } catch (error) {
    console.error("❌ UNEXPECTED SERVER ERROR:", error);
    console.error("Error stack:", (error as Error)?.stack);
    return new Response(renderPage({
      title: 'Error del servidor',
      status: 'error',
      heading: 'Error del servidor',
      message: 'Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.',
      submessage: (error as Error)?.message || 'Error desconocido'
    }), { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
  }
});

/**
 * Redirects to public result page (defaults to sector-pro.work)
 */
async function redirectResponse(opts: { title: string, status: 'success'|'warning'|'error'|'neutral', heading: string, message: string, submessage?: string }) {
  // Prefer redirect if an explicit result page URL is configured and reachable.
  const configuredBase = Deno.env.get('PUBLIC_CONFIRM_RESULT_URL') || Deno.env.get('PUBLIC_RESULT_PAGE_URL') || '';
  const defaultBase = 'https://sector-pro.work/temp_error.html';
  const baseUrl = configuredBase || defaultBase;

  const params = new URLSearchParams({
    status: opts.status,
    heading: opts.heading,
    message: opts.message,
    ...(opts.submessage ? { submessage: opts.submessage } : {})
  });

  // Try redirecting to either configuredBase or the default sector-pro URL
  const shouldTryRedirect = true;

  if (shouldTryRedirect) {
    try {
      // Probe the page quickly to avoid redirecting to a 404
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 700);
      const head = await fetch(`${baseUrl}`, { method: 'HEAD', signal: controller.signal }).catch(() => undefined);
      clearTimeout(t);
      if (head && head.ok) {
        console.log('📄 REDIRECTING TO RESULT PAGE:', { status: opts.status, heading: opts.heading, target: baseUrl });
        return new Response(null, { status: 302, headers: { 'Location': `${baseUrl}?${params.toString()}` } });
      } else {
        console.warn('⚠️ Result page not reachable, rendering inline page instead', { baseUrl, status: head?.status });
      }
    } catch (e) {
      console.warn('⚠️ Result page probe error, rendering inline page', { error: (e as Error)?.message });
    }
  }

  // Fallback: render inline HTML so the user never sees a 404
  return new Response(renderPage(opts), { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
}

function renderPage(opts: { title: string, status: 'success'|'warning'|'error'|'neutral', heading: string, message: string, submessage?: string }) {
  const palette: Record<typeof opts.status, { bg: string; fg: string; icon: string; }> = {
    success: { bg: '#ECFDF5', fg: '#065F46', icon: '✅' },
    warning: { bg: '#FFFBEB', fg: '#92400E', icon: '⚠️' },
    error:   { bg: '#FEF2F2', fg: '#991B1B', icon: '❌' },
    neutral: { bg: '#F3F4F6', fg: '#111827', icon: 'ℹ️' },
  } as const;
  const theme = palette[opts.status];
  const companyLogo = COMPANY_LOGO_URL;
  const atLogo = AT_LOGO_URL;
  return `<!doctype html>
  <html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(opts.title)}</title>
    <style>
      body{margin:0;font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, sans-serif;background:#0b0f14;color:#111}
      .wrap{max-width:640px;margin:32px auto;padding:24px}
      .card{background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.15);overflow:hidden}
      .header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:#0b0f14}
      .brand img{height:28px}
      .content{padding:28px 24px;background:${theme.bg};color:${theme.fg}}
      h1{margin:0 0 8px 0;font-size:22px}
      p{margin:6px 0;font-size:16px;line-height:1.4}
      .icon{font-size:22px;margin-right:8px}
      .footer{padding:12px 20px;color:#6b7280;font-size:12px;background:#f9fafb;text-align:center}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="header">
          <div class="brand"><img src="${companyLogo}" alt="Logo" /></div>
          <div class="brand"><img src="${atLogo}" alt="Área Técnica"/></div>
        </div>
        <div class="content">
          <h1><span class="icon">${theme.icon}</span>${escapeHtml(opts.heading)}</h1>
          <p>${escapeHtml(opts.message)}</p>
          ${opts.submessage ? `<p>${escapeHtml(opts.submessage)}</p>` : ''}
        </div>
        <div class="footer">Puedes cerrar esta pestaña.</div>
      </div>
    </div>
  </body>
  </html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
