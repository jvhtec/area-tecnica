import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      return redirectResponse({
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
      return redirectResponse({
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
      return redirectResponse({
        title: 'Error de base de datos',
        status: 'error',
        heading: 'Error de base de datos',
        message: 'No se pudo verificar la solicitud. Inténtalo de nuevo.'
      });
    }
    
    if (!row) {
      console.log('❌ STEP 4 FAILED: Request not found in database', { rid });
      return redirectResponse({
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
        return redirectResponse({
          title: 'Token inválido',
          status: 'error',
          heading: 'Token inválido',
          message: 'Este enlace no es válido. Utiliza el enlace original de tu correo.'
        });
      }
      console.log('✅ STEP 5: Token validated successfully');
    } catch (cryptoError) {
      console.error('❌ STEP 5 FAILED: Crypto error', cryptoError);
      return redirectResponse({
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
      return redirectResponse({
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
          supabase.from('jobs').select('id,title,start_time,end_time').eq('id', row.job_id).maybeSingle(),
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
            .select('job_id,status')
            .eq('technician_id', row.profile_id)
            .eq('status', 'confirmed');

          let hasConflict = false;
          if (!assignErr && (confirmedAssigns?.length ?? 0) > 0) {
            const otherJobIds = confirmedAssigns!.map(a => a.job_id).filter(id => id !== row.job_id);
            if (otherJobIds.length > 0) {
              const { data: otherJobs } = await supabase
                .from('jobs')
                .select('id,start_time,end_time,title')
                .in('id', otherJobIds);
              const targetStart = job.start_time ? new Date(job.start_time) : null;
              const targetEnd = job.end_time ? new Date(job.end_time) : null;
              const overlap = targetStart && targetEnd ? (otherJobs ?? []).find(j => j.start_time && j.end_time && (new Date(j.start_time) < targetEnd) && (new Date(j.end_time) > targetStart)) : null;
              if (overlap) {
                hasConflict = true;
                await supabase.from('staffing_events').insert({
                  staffing_request_id: rid,
                  event: 'auto_assign_skipped_conflict',
                  meta: { conflicting_job_id: overlap.id, conflicting_title: overlap.title }
                });
              }
            }
          }

          if (!hasConflict) {
            // 4) Upsert assignment(s): handles single or batch dates
            async function upsertAssignmentFor(targetDate: string | null) {
              console.log('🧾 upsertAssignmentFor invoked', {
                job_id: row.job_id,
                technician_id: row.profile_id,
                targetDate,
                batch_id: (row as any)?.batch_id || null,
              });
              const rolePatch: Record<string, string | null> = {};
              if (prof.department === 'sound') rolePatch['sound_role'] = chosenRole;
              else if (prof.department === 'lights') rolePatch['lights_role'] = chosenRole;
              else if (prof.department === 'video') rolePatch['video_role'] = chosenRole;
              const upsertPayload: any = {
                job_id: row.job_id,
                technician_id: row.profile_id,
                status: 'confirmed',
                assigned_at: new Date().toISOString(),
                assignment_source: 'staffing',
                response_time: new Date().toISOString(),
                ...rolePatch
              };
              if (targetDate) {
                upsertPayload.single_day = true;
                upsertPayload.assignment_date = targetDate;
              } else {
                // Be explicit for whole-job rows to satisfy partial-unique predicate
                upsertPayload.single_day = false;
                upsertPayload.assignment_date = null;
              }
              const onConflictKeys = targetDate ? 'job_id,technician_id,assignment_date' : 'job_id,technician_id';
              let upsertErr: any = null;
              let upsertAttemptSummary: string | null = null;

              const attemptUpsert = async () => {
                const { error } = await supabase
                  .from('job_assignments')
                  .upsert(upsertPayload, { onConflict: onConflictKeys });
                return error;
              };

              // Attempt upsert using the appropriate unique index
              upsertErr = await attemptUpsert();
              if (!upsertErr) {
                upsertAttemptSummary = targetDate ? 'direct-upsert-per-day' : 'direct-upsert-whole-job';
              } else if (upsertErr?.code === '42P10') {
                // Fallback for environments where partial-unique indexes aren't applied yet.
                // Emulate upsert with update-then-insert to avoid hard failure.
                try {
                  const updateQuery = supabase
                    .from('job_assignments')
                    .update(upsertPayload)
                    .eq('job_id', row.job_id)
                    .eq('technician_id', row.profile_id);
                  const updateExec = targetDate
                    ? updateQuery.eq('single_day', true).eq('assignment_date', targetDate)
                    : updateQuery.eq('single_day', false).is('assignment_date', null);
                  const { data: updRows, error: updErr } = await updateExec.select('id');
                  if (!updErr && Array.isArray(updRows) && updRows.length > 0) {
                    upsertErr = null;
                    upsertAttemptSummary = targetDate ? 'fallback-update-per-day' : 'fallback-update-whole-job';
                  } else {
                    const { error: insErr } = await supabase
                      .from('job_assignments')
                      .insert(upsertPayload);
                    if (!insErr) {
                      upsertErr = null;
                      upsertAttemptSummary = targetDate ? 'fallback-insert-per-day' : 'fallback-insert-whole-job';
                    } else {
                      upsertAttemptSummary = 'fallback-insert-failed';
                      upsertErr = insErr;
                    }
                  }
                } catch (fbErr) {
                  upsertAttemptSummary = 'fallback-exception';
                  upsertErr = fbErr;
                }
              }

              if (upsertErr) {
                console.error('❌ job_assignments upsert failed', {
                  job_id: row.job_id,
                  technician_id: row.profile_id,
                  targetDate,
                  onConflictKeys,
                  attemptSummary: upsertAttemptSummary,
                  error: upsertErr,
                });
                await supabase.from('staffing_events').insert({ staffing_request_id: rid, event: 'auto_assign_upsert_error', meta: { message: upsertErr.message, target_date: targetDate, on_conflict: onConflictKeys, attempt: upsertAttemptSummary } });
              } else {
                const { data: assignmentProbe, error: probeErr } = await supabase
                  .from('job_assignments')
                  .select('id,assignment_date,status')
                  .eq('job_id', row.job_id)
                  .eq('technician_id', row.profile_id)
                  .order('assignment_date', { ascending: true });
                if (probeErr) {
                  console.warn('⚠️ Unable to verify job_assignments after upsert', { job_id: row.job_id, technician_id: row.profile_id, error: probeErr });
                } else {
                  console.log('✅ job_assignments per-day verification', {
                    job_id: row.job_id,
                    technician_id: row.profile_id,
                    targetDate,
                    onConflictKeys,
                    attemptSummary: upsertAttemptSummary,
                    assignmentDates: (assignmentProbe || []).map(a => ({ id: a.id, assignment_date: a.assignment_date, status: a.status })),
                  });
                }
                await supabase.from('staffing_events').insert({ staffing_request_id: rid, event: 'auto_assign_upsert_ok', meta: { role: chosenRole, department: prof.department, target_date: targetDate, attempt: upsertAttemptSummary } });
              }
            }

            if ((row as any)?.batch_id) {
              const updatedIds = new Set((updatedBatchRows ?? []).map(r => r.id));
              let targetRows = updatedBatchRows ?? [];

              if (!targetRows.length) {
                const { data: batchRows } = await supabase
                  .from('staffing_requests')
                  .select('id,target_date,single_day,status')
                  .eq('batch_id', (row as any).batch_id)
                  .eq('job_id', row.job_id)
                  .eq('profile_id', row.profile_id)
                  .eq('phase', row.phase);
                targetRows = (batchRows || []).filter(r => !updatedIds.size || updatedIds.has(r.id));
              }

              for (const br of targetRows) {
                const isSingleDay = !!br.single_day;
                const hasDate = typeof br.target_date === 'string' && br.target_date.trim().length > 0;
                if (isSingleDay && !hasDate) {
                  await supabase.from('staffing_events').insert({
                    staffing_request_id: rid,
                    event: 'auto_assign_skipped_no_date',
                    meta: { request_id: br.id }
                  });
                  continue;
                }

                const assignmentDate = isSingleDay && hasDate ? br.target_date : null;
                console.log('📅 Processing batch assignment row', {
                  request_id: br.id,
                  job_id: row.job_id,
                  technician_id: row.profile_id,
                  batch_id: (row as any).batch_id,
                  assignmentDate,
                });
                await upsertAssignmentFor(assignmentDate);
              }
            } else {
              console.log('📅 Processing single assignment row', {
                job_id: row.job_id,
                technician_id: row.profile_id,
                targetDate: (row as any).single_day && (row as any).target_date ? (row as any).target_date : null,
              });
              await upsertAssignmentFor((row as any).single_day && (row as any).target_date ? (row as any).target_date : null);
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
    return redirectResponse({
      title: isOk ? '¡Confirmado!' : 'Respuesta registrada',
      status: isOk ? 'success' : 'neutral',
      heading: isOk ? '¡Gracias! Confirmado' : 'Respuesta registrada',
      message: `Tu respuesta sobre ${phaseText} ha sido registrada.`,
      submessage: 'Puedes cerrar esta pestaña.'
    });
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
 * Redirects to GitHub Pages parametric error page
 */
function redirectResponse(opts: { title: string, status: 'success'|'warning'|'error'|'neutral', heading: string, message: string, submessage?: string }) {
  console.log('📄 REDIRECTING TO RESULT PAGE:', { status: opts.status, heading: opts.heading });
  
  const baseUrl = 'https://jvhtec.github.io/area-tecnica/public/temp_error.html';
  const params = new URLSearchParams({
    status: opts.status,
    heading: opts.heading,
    message: opts.message,
    ...(opts.submessage ? { submessage: opts.submessage } : {})
  });
  
  return new Response(null, {
    status: 302,
    headers: {
      'Location': `${baseUrl}?${params.toString()}`
    }
  });
}
