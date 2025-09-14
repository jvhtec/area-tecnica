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
  try {
    const url = new URL(req.url);
    const rid = url.searchParams.get("rid");
    const action = url.searchParams.get("a"); // 'confirm' | 'decline'
    const exp = url.searchParams.get("exp");
    const t = url.searchParams.get("t");
    
    if (!rid || !action || !exp || !t) {
      return htmlResponse(renderPage({
        title: 'Enlace inválido',
        status: 'error',
        heading: 'Enlace inválido',
        message: 'Este enlace está incompleto o le faltan parámetros.'
      }), 400);
    }
    
    if (new Date(exp).getTime() < Date.now()) {
      return htmlResponse(renderPage({
        title: 'Enlace caducado',
        status: 'warning',
        heading: 'Enlace caducado',
        message: 'Este enlace ha caducado. Contacta con tu responsable para solicitar uno nuevo.'
      }), 410);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: row } = await supabase.from("staffing_requests").select("*").eq("id", rid).maybeSingle();
    
    if (!row) {
      return htmlResponse(renderPage({
        title: 'No encontrado',
        status: 'error',
        heading: 'Solicitud no encontrada',
        message: 'No hemos podido localizar esta solicitud.'
      }), 404);
    }

    // Recompute expected token hash (HMAC over rid:phase:exp)
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(TOKEN_SECRET),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key,
      new TextEncoder().encode(`${rid}:${row.phase}:${exp}`)));
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", sig));
    const token_hash_expected = Array.from(digest).map(x=>x.toString(16).padStart(2,'0')).join('');

    // Compare provided token too (defense-in-depth)
    const providedHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", b64uToU8(t))))
      .map(x=>x.toString(16).padStart(2,'0')).join('');

    if (token_hash_expected !== row.token_hash && providedHash !== row.token_hash) {
      return htmlResponse(renderPage({
        title: 'Token inválido',
        status: 'error',
        heading: 'Token inválido',
        message: 'Este enlace no es válido. Utiliza el enlace original de tu correo.'
      }), 403);
    }

    // Check if already responded
    if (row.status !== 'pending') {
      const statusText = row.status === 'confirmed' ? 'confirmado' : 'rechazado';
      const phase = row.phase === 'offer' ? 'la oferta' : 'la disponibilidad';
      return htmlResponse(renderPage({
        title: 'Respuesta registrada',
        status: 'warning',
        heading: 'Respuesta ya registrada',
        message: `Ya has ${statusText} ${phase}.`,
        submessage: 'Puedes cerrar esta pestaña.'
      }));
    }

    const newStatus = action === "confirm" ? "confirmed" : "declined";
    await supabase.from("staffing_requests").update({ status: newStatus }).eq("id", rid);
    await supabase.from("staffing_events").insert({ staffing_request_id: rid, event: `clicked_${action}` });

    // If an offer was confirmed, auto-create/update a job assignment with role
    if (newStatus === 'confirmed' && row.phase === 'offer') {
      try {
        // 1) Resolve chosen role from last email_sent event for this request (offer phase)
        const { data: lastEmail, error: lastEmailErr } = await supabase
          .from('staffing_events')
          .select('meta')
          .eq('staffing_request_id', rid)
          .eq('event', 'email_sent')
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
            // 4) Upsert assignment: set confirmed + role field based on department
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
            const { data: upserted, error: upsertErr } = await supabase
              .from('job_assignments')
              .upsert(upsertPayload, { onConflict: 'job_id,technician_id' })
              .select('job_id, technician_id')
              .maybeSingle();

            if (upsertErr) {
              await supabase.from('staffing_events').insert({
                staffing_request_id: rid,
                event: 'auto_assign_upsert_error',
                meta: { message: upsertErr.message }
              });
            } else {
              await supabase.from('staffing_events').insert({
                staffing_request_id: rid,
                event: 'auto_assign_upsert_ok',
                meta: { role: chosenRole, department: prof.department }
              });
            }

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
    const html = renderPage({
      title: isOk ? '¡Confirmado!' : 'Respuesta registrada',
      status: isOk ? 'success' : 'neutral',
      heading: isOk ? '¡Gracias! Confirmado' : 'Respuesta registrada',
      message: `Tu respuesta sobre ${phaseText} ha sido registrada.`,
      submessage: 'Puedes cerrar esta pestaña.'
    });
    return htmlResponse(html);
  } catch (error) {
    console.error("Server error:", error);
    return htmlResponse(renderPage({
      title: 'Error del servidor',
      status: 'error',
      heading: 'Error del servidor',
      message: 'Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.'
    }), 500);
  }
});

// Render a branded, Spanish corporate page
function renderPage(opts: { title: string, status: 'success'|'warning'|'error'|'neutral', heading: string, message: string, submessage?: string }) {
  const color = opts.status === 'success' ? '#10b981'
    : opts.status === 'warning' ? '#f59e0b'
    : opts.status === 'error' ? '#ef4444'
    : '#111827';
  const emoji = opts.status === 'success' ? '✅'
    : opts.status === 'warning' ? '⚠️'
    : opts.status === 'error' ? '❌'
    : 'ℹ️';
  
  const submessageHtml = opts.submessage ? `<p class="sub">${opts.submessage}</p>` : '';
  
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${opts.title}</title>
<style>
body { margin:0; padding:0; background:#f5f7fb; font-family: Arial, Helvetica, sans-serif; color:#111827; }
.card { background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.06); max-width:640px; margin:24px auto; }
.header { padding:16px 20px; background:#0b0b0b; }
.logos { display:flex; align-items:center; justify-content:space-between; }
.logos img { display:block; border:0; max-height:36px; }
.content { padding:24px; text-align:center; }
.emoji { font-size:48px; margin-bottom:8px; }
.heading { margin:0 0 8px 0; font-size:22px; color:${color}; }
.message { margin:0; color:#374151; }
.sub { margin:12px 0 0 0; color:#9ca3af; font-size:14px; }
.footer { padding:16px 24px; background:#f9fafb; color:#6b7280; font-size:12px; line-height:1.5; border-top:1px solid #e5e7eb; }
.links a { color:#6b7280; text-decoration:underline; }
</style>
</head>
<body>
<div class="card">
<div class="header">
<div class="logos">
<a href="https://www.sector-pro.com" target="_blank" rel="noopener noreferrer">
<img src="${COMPANY_LOGO_URL}" alt="Sector Pro" height="36">
</a>
<a href="https://area-tecnica.lovable.app" target="_blank" rel="noopener noreferrer">
<img src="${AT_LOGO_URL}" alt="Área Técnica" height="36">
</a>
</div>
</div>
<div class="content">
<div class="emoji">${emoji}</div>
<h2 class="heading">${opts.heading}</h2>
<p class="message">${opts.message}</p>
${submessageHtml}
</div>
<div class="footer">
<div style="margin-bottom:8px;">Este contenido es confidencial y puede contener información privilegiada. Si no eres el destinatario, por favor notifícanos y elimina este mensaje.</div>
<div class="links">Sector Pro · <a href="https://www.sector-pro.com">www.sector-pro.com</a> &nbsp;|&nbsp; Área Técnica · <a href="https://area-tecnica.lovable.app">area-tecnica.lovable.app</a></div>
</div>
</div>
</body>
</html>`;
}

function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache',
      'Vary': 'User-Agent',
    }
  });
}
