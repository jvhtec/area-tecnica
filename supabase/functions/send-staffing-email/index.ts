import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
const COMPANY_LOGO_URL = Deno.env.get("COMPANY_LOGO_URL") || `${SUPABASE_URL}/storage/v1/object/public/company-assets/sector-pro-logo.png`;
const AT_LOGO_URL = Deno.env.get("AT_LOGO_URL") || `${SUPABASE_URL}/storage/v1/object/public/company-assets/area-tecnica-logo.png`;
const DAILY_CAP = parseInt(Deno.env.get("STAFFING_DAILY_CAP") ?? "100", 10);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const body = await req.json();
    console.log('📥 RECEIVED PAYLOAD:', JSON.stringify(body, null, 2));
    
    const { job_id, profile_id, phase, role, message } = body;
    
    // Enhanced validation logging
    console.log('🔍 VALIDATING FIELDS:', {
      job_id: { value: job_id, type: typeof job_id, isValid: !!job_id },
      profile_id: { value: profile_id, type: typeof profile_id, isValid: !!profile_id },
      phase: { value: phase, type: typeof phase, isValidPhase: ["availability","offer"].includes(phase) },
      role: { value: role ?? null },
      message: { value: message ?? null }
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
      BREVO_KEY: { exists: !!BREVO_KEY, length: BREVO_KEY?.length },
      BREVO_FROM: { exists: !!BREVO_FROM, value: BREVO_FROM }
    });

    if (!TOKEN_SECRET || !CONFIRM_BASE || !BREVO_KEY || !BREVO_FROM) {
      const missingEnvs = [];
      if (!TOKEN_SECRET) missingEnvs.push('STAFFING_TOKEN_SECRET');
      if (!CONFIRM_BASE) missingEnvs.push('PUBLIC_CONFIRM_BASE');
      if (!BREVO_KEY) missingEnvs.push('BREVO_API_KEY');
      if (!BREVO_FROM) missingEnvs.push('BREVO_FROM');
      
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
        .eq("event", "email_sent");
      
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
      const [jobResult, techResult] = await Promise.all([
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
        supabase.from("profiles").select("id,first_name,last_name,email").eq("id", profile_id).maybeSingle()
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

      if (!tech?.email) {
        console.error('❌ PROFILE NOT FOUND OR NO EMAIL:', { profile_id, has_email: !!tech?.email });
        return new Response(JSON.stringify({ 
          error: "Profile not found or no email address", 
          details: { profile_id, has_profile: !!tech, has_email: !!tech?.email }
        }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const fullName = `${tech.first_name || ''} ${tech.last_name || ''}`.trim();
      console.log('👤 TECH INFO:', { fullName, email: '***@***.***' });

      // Step 2b: Conflict check — avoid sending if overlaps with confirmed assignment
      try {
        console.log('🕒 CONFLICT CHECK: fetching confirmed assignments for technician...');
        const { data: confirmedAssigns, error: assignErr } = await supabase
          .from('job_assignments')
          .select('job_id,status')
          .eq('technician_id', profile_id)
          .eq('status', 'confirmed');

        if (assignErr) {
          console.warn('⚠️ Conflict check skipped due to assignment fetch error:', assignErr);
        } else if ((confirmedAssigns?.length ?? 0) > 0) {
          const otherJobIds = confirmedAssigns!.map(a => a.job_id).filter(id => id !== job_id);
          if (otherJobIds.length > 0) {
            const { data: otherJobs, error: jobsErr } = await supabase
              .from('jobs')
              .select('id,title,start_time,end_time')
              .in('id', otherJobIds);
            if (jobsErr) {
              console.warn('⚠️ Conflict check skipped due to jobs fetch error:', jobsErr);
            } else {
              const js = (otherJobs ?? []).map(j => ({
                id: j.id,
                title: j.title,
                start: j.start_time ? new Date(j.start_time) : null,
                end: j.end_time ? new Date(j.end_time) : null
              }));
              const targetStart = job.start_time ? new Date(job.start_time) : null;
              const targetEnd = job.end_time ? new Date(job.end_time) : null;
              const overlap = targetStart && targetEnd ? js.find(j => j.start && j.end && (j.start < targetEnd) && (j.end > targetStart)) : null;
              if (overlap) {
                console.log('⛔ Conflict detected with confirmed job:', overlap);
                return new Response(JSON.stringify({
                  error: 'Technician has a confirmed overlapping job',
                  details: {
                    conflicting_job: {
                      id: overlap.id,
                      title: overlap.title,
                      start_time: overlap.start?.toISOString(),
                      end_time: overlap.end?.toISOString()
                    },
                    target_job: { id: job.id, title: job.title, start_time: job.start_time, end_time: job.end_time },
                    technician: { id: tech.id, name: fullName }
                  }
                }), {
                  status: 409,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }
            }
          }
        }
      } catch (conflictCheckErr) {
        console.warn('⚠️ Conflict check encountered an error, continuing to send email:', conflictCheckErr);
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

      // Step 4: Insert/update staffing request
      console.log('💾 SAVING STAFFING REQUEST...');
      let insertedId = rid;
      const insertRes = await supabase.from("staffing_requests").insert({
        id: rid, job_id, profile_id, phase, status: "pending",
        token_hash, token_expires_at: exp
      });
      
      console.log('💾 INSERT RESULT:', { error: insertRes.error });
      
      if (insertRes.error && insertRes.error.code === "23505") {
        console.log('🔄 DUPLICATE FOUND, UPDATING...');
        const upd = await supabase.from("staffing_requests")
          .update({ token_hash, token_expires_at: exp, updated_at: new Date().toISOString() })
          .eq("job_id", job_id).eq("profile_id", profile_id).eq("phase", phase).eq("status", "pending")
          .select("id").maybeSingle();
        
        console.log('🔄 UPDATE RESULT:', { data: upd.data, error: upd.error });
        if (upd.data?.id) insertedId = upd.data.id;
      } else if (insertRes.error) {
        console.error('❌ STAFFING REQUEST INSERT ERROR:', insertRes.error);
        return new Response(JSON.stringify({ 
          error: "Database error saving request", 
          details: insertRes.error 
        }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Step 5: Build email content
      console.log('📧 BUILDING EMAIL CONTENT...');
      const confirmUrl = `${CONFIRM_BASE}?rid=${encodeURIComponent(insertedId)}&a=confirm&exp=${encodeURIComponent(exp)}&t=${token}`;
      const declineUrl = `${CONFIRM_BASE}?rid=${encodeURIComponent(insertedId)}&a=decline&exp=${encodeURIComponent(exp)}&t=${token}`;

      const subject = phase === "availability"
        ? `Disponibilidad para ${job.title}`
        : `Oferta: ${job.title}${role ? ` — ${role}` : ''}`;

      // Spanish date/time formatting
      const fmtDate = (d?: string | null) => d ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeStyle: undefined }).format(new Date(d)) : 'TBD';
      const fmtTime = (d?: string | null) => d ? new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : 'TBD';
      const startDate = fmtDate(job.start_time);
      const endDate = fmtDate(job.end_time);
      const callTime = fmtTime(job.start_time);
      const loc = job.locations?.formatted_address ?? 'Por confirmar';

      const safeMessage = (message ?? '').replace(/</g, '&lt;').replace(/\n/g, '<br/>');

      const primaryCta = phase === 'availability' ? 'Estoy disponible' : 'Acepto la oferta';
      const secondaryCta = phase === 'availability' ? 'No estoy disponible' : 'Rechazo la oferta';

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
                          <a href="https://area-tecnica.lovable.app" target="_blank" rel="noopener noreferrer">
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
                        ? `¿Puedes confirmar tu disponibilidad para <b>${job.title}</b>?`
                        : `Tienes una oferta para <b>${job.title}</b>. Por favor, confirma:`}
                    </p>
                    ${phase === 'offer' && role ? `<p style="margin:8px 0 0 0;color:#111827;"><b>Puesto:</b> ${role}</p>` : ''}
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
                            <div><b>Fechas:</b> ${startDate}${job.end_time ? ` — ${endDate}` : ''}</div>
                            <div><b>Horario:</b> ${callTime}</div>
                            <div><b>Ubicación:</b> ${loc}</div>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
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
                      &nbsp;|&nbsp; Área Técnica · <a href="https://area-tecnica.lovable.app" style="color:#6b7280;text-decoration:underline;">area-tecnica.lovable.app</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>`;

      // Step 6: Send email via Brevo
      console.log('🔗 CONFIRM LINKS:', { confirmUrl, declineUrl });
      console.log('📤 SENDING EMAIL VIA BREVO...');
      const emailPayload = {
        sender: { email: BREVO_FROM },
        to: [{ email: tech.email }],
        subject,
        htmlContent: html
      };
      
      console.log('📤 EMAIL PAYLOAD:', { 
        sender: emailPayload.sender, 
        to: [{ email: '***@***.***' }], 
        subject: emailPayload.subject 
      });

      const sendRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload)
      });

      console.log('📤 BREVO RESPONSE:', { 
        status: sendRes.status, 
        statusText: sendRes.statusText,
        ok: sendRes.ok 
      });

      // Step 7: Log the email event
      console.log('📊 LOGGING EMAIL EVENT...');
      const eventRes = await supabase.from("staffing_events").insert({
        staffing_request_id: insertedId, 
        event: "email_sent", 
        meta: { phase, status: sendRes.status, role: role ?? null, message: message ?? null }
      });
      
      console.log('📊 EVENT LOG RESULT:', { error: eventRes.error });

      // Step 8: Return result
      if (sendRes.ok) {
        console.log('✅ EMAIL SENT SUCCESSFULLY');
        return new Response(JSON.stringify({ success: true }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        const errorText = await sendRes.text();
        console.error('❌ BREVO EMAIL ERROR:', errorText);
        return new Response(JSON.stringify({ 
          error: "Email delivery failed", 
          details: { status: sendRes.status, message: errorText }
        }), { 
          status: sendRes.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
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
