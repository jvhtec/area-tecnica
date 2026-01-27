import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BREVO_KEY = Deno.env.get("BREVO_API_KEY") || '';
const BREVO_FROM = Deno.env.get("BREVO_FROM") || '';
const COMPANY_TZ = Deno.env.get('COMPANY_TZ') || 'Europe/Madrid';
// Optional branding (match other functions)
const COMPANY_LOGO_URL = Deno.env.get("COMPANY_LOGO_URL_W") || `${SUPABASE_URL}/storage/v1/object/public/company-assets/sectorlogow.png`;
const AT_LOGO_URL = Deno.env.get("AT_LOGO_URL") || `${SUPABASE_URL}/storage/v1/object/public/company-assets/area-tecnica-logo.png`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function resolveActorId(supabase: ReturnType<typeof createClient>, req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) return null;
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const actorId = await resolveActorId(supabase, req);
    const body = await req.json();
    const { job_id, profile_id, phase } = body as { job_id: string, profile_id: string, phase: 'availability'|'offer' };

    if (!job_id || !profile_id || !['availability','offer'].includes(phase)) {
      return new Response(JSON.stringify({ error: 'Bad Request', details: { job_id, profile_id, phase } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Find the most recent staffing_request for this tuple (expired or pending)
    const { data: sr, error: srErr } = await supabase
      .from('staffing_requests')
      .select('id, status, created_at, updated_at')
      .eq('job_id', job_id)
      .eq('profile_id', profile_id)
      .eq('phase', phase)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (srErr || !sr) {
      return new Response(JSON.stringify({ error: 'No staffing request found to notify' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Determine channel used originally via staffing_events
    const { data: evs, error: evErr } = await supabase
      .from('staffing_events')
      .select('event, created_at')
      .eq('staffing_request_id', sr.id)
      .in('event', ['email_sent','whatsapp_sent'])
      .order('created_at', { ascending: false })
      .limit(1);
    if (evErr) {
      return new Response(JSON.stringify({ error: 'Failed to resolve original channel', details: evErr }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const last = evs?.[0] || null;
    const channel: 'email'|'whatsapp' = last?.event === 'whatsapp_sent' ? 'whatsapp' : 'email';

    // Fetch job + technician + actor info
    const [jobRes, techRes, actorRes] = await Promise.all([
      supabase.from('jobs').select('id,title,start_time,end_time,locations(formatted_address)').eq('id', job_id).maybeSingle(),
      supabase.from('profiles').select('id,first_name,last_name,email,phone').eq('id', profile_id).maybeSingle(),
      actorId ? supabase.from('profiles').select('waha_endpoint').eq('id', actorId).maybeSingle() : Promise.resolve({ data: null, error: null })
    ]);
    if (jobRes.error || !jobRes.data) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (techRes.error || !techRes.data) return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const job = jobRes.data as any;
    const tech = techRes.data as any;
    const fullName = `${tech.first_name || ''} ${tech.last_name || ''}`.trim();
    const fmtDate = (d?: string | null) => d ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeZone: COMPANY_TZ }).format(new Date(d)) : 'TBD';
    const fmtTime = (d?: string | null) => d ? new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: COMPANY_TZ }).format(new Date(d)) : 'TBD';
    const startDate = fmtDate(job.start_time);
    const endDate = fmtDate(job.end_time);
    const callTime = fmtTime(job.start_time);
    const loc = job.locations?.formatted_address ?? 'Por confirmar';

    // Push broadcast to notify cancellation (best-effort, non-blocking)
    try {
      const pushUrl = `${SUPABASE_URL}/functions/v1/push`;
      const type = phase === 'availability' ? 'staffing.availability.cancelled' : 'staffing.offer.cancelled';
      await fetch(pushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE}`,
        },
        body: JSON.stringify({
          action: 'broadcast',
          type,
          job_id,
          recipient_id: profile_id,
          recipient_name: fullName,
        }),
      }).catch(() => undefined);
    } catch (_) {}

    const subject = phase === 'availability' ? `Solicitud cancelada: ${job.title}` : `Oferta cancelada: ${job.title}`;
    const reason = phase === 'availability' ? 'La solicitud de disponibilidad' : 'La oferta';

    if (channel === 'whatsapp') {
      // Validate phone and WAHA access
      if (!tech.phone) return new Response(JSON.stringify({ error: 'No phone for WhatsApp' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!actorRes.data?.waha_endpoint) return new Response(JSON.stringify({ error: 'Actor not authorized for WhatsApp' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const normalizeBase = (s: string) => {
        let b = (s || '').trim();
        if (!/^https?:\/\//i.test(b)) b = 'https://' + b;
        return b.replace(/\/+$/, '');
      };
      const base = normalizeBase(actorRes.data.waha_endpoint || '');
      const { data: cfg } = await supabase.rpc('get_waha_config', { base_url: base });
      const apiKey = (cfg?.[0] as any)?.api_key || Deno.env.get('WAHA_API_KEY') || '';
      const session = (cfg?.[0] as any)?.session || Deno.env.get('WAHA_SESSION') || 'default';
      const defaultCC = Deno.env.get('WA_DEFAULT_COUNTRY_CODE') || '+34';
      const headersWA: Record<string,string> = { 'Content-Type': 'application/json' };
      if (apiKey) headersWA['X-API-Key'] = apiKey;
      function normalizePhone(raw: string, defaultCountry: string): { ok: true; value: string } | { ok: false; reason: string } {
        if (!raw) return { ok: false, reason: 'empty' } as const;
        const trimmed = raw.trim();
        if (!trimmed) return { ok: false, reason: 'empty' } as const;
        let digits = trimmed.replace(/[\s\-()]/g, '');
        if (digits.startsWith('00')) digits = '+' + digits.slice(2);
        if (!digits.startsWith('+')) {
          if (/^[67]\d{8}$/.test(digits)) digits = '+34' + digits; else digits = (defaultCountry.startsWith('+') ? defaultCountry : `+${defaultCountry}`) + digits;
        }
        if (!/^\+\d{7,15}$/.test(digits)) return { ok: false, reason: 'invalid_format' } as const;
        return { ok: true, value: digits } as const;
      }
      const norm = normalizePhone(tech.phone || '', defaultCC);
      if (!norm.ok) return new Response(JSON.stringify({ error: 'Invalid phone format' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const chatId = norm.value.replace(/^\+/, '').replace(/\D/g, '') + '@c.us';
      const textLines = [
        `Hola ${fullName || ''},`,
        `${reason} para ${job.title} ya no está vigente.`,
        '',
        'Detalles del trabajo:',
        `- Fechas: ${startDate}${job.end_time ? ` — ${endDate}` : ''}`,
        `- Horario: ${callTime}`,
        `- Ubicación: ${loc}`,
      ];
      const sendUrl = `${base}/api/sendText`;
      const payload = { chatId, text: textLines.join('\n'), session, linkPreview: false };
      const waRes = await fetch(sendUrl, { method: 'POST', headers: headersWA, body: JSON.stringify(payload) });
      await supabase.from('staffing_events').insert({ staffing_request_id: sr.id, event: 'whatsapp_cancel_notice_sent', meta: { phase } });
      if (!waRes.ok) {
        const t = await waRes.text().catch(() => '');
        return new Response(JSON.stringify({ error: 'WhatsApp delivery failed', details: { status: waRes.status, body: t } }), { status: waRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, channel: 'whatsapp' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else {
      // Email channel
      if (!BREVO_KEY || !BREVO_FROM) return new Response(JSON.stringify({ error: 'Email channel not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!tech.email) return new Response(JSON.stringify({ error: 'No email on profile' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
                      ${reason} para <b>${job.title}</b> ya no está vigente.
                    </p>
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
                    <p style="margin:0;color:#374151;">Gracias.</p>
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
      const emailPayload = { sender: { email: BREVO_FROM }, to: [{ email: tech.email }], subject, htmlContent: html };
      const sendRes = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(emailPayload) });
      await supabase.from('staffing_events').insert({ staffing_request_id: sr.id, event: 'email_cancel_notice_sent', meta: { phase, status: sendRes.status } });
      if (!sendRes.ok) {
        const err = await sendRes.text().catch(() => '');
        return new Response(JSON.stringify({ error: 'Email delivery failed', details: { status: sendRes.status, message: err } }), { status: sendRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, channel: 'email' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (error) {
    console.error('notify-staffing-cancellation error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
