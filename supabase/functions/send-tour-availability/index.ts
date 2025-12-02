import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const BREVO_KEY = Deno.env.get('BREVO_API_KEY')!;
    const BREVO_FROM = Deno.env.get('BREVO_FROM')!;
    const COMPANY_LOGO_URL = Deno.env.get('COMPANY_LOGO_URL_W') || `${SUPABASE_URL}/storage/v1/object/public/company-assets/sectorlogow.png`;
    const AT_LOGO_URL = Deno.env.get('AT_LOGO_URL') || `${SUPABASE_URL}/storage/v1/object/public/company-assets/area-tecnica-logo.png`;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // AuthN: require logged-in admin/management
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const token = authHeader.replace('Bearer ', '').trim();
    const { data: userRes } = await supabase.auth.getUser(token);
    const requester = userRes?.user;
    if (!requester) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const { data: requesterProfile } = await supabase.from('profiles').select('role,waha_endpoint').eq('id', requester.id).maybeSingle();
    const requesterRole = (requesterProfile as any)?.role;
    if (!['admin','management'].includes(requesterRole || '')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const body = await req.json();
    const { tour_id, profile_id, channel, message, tour_pdf_path } = body || {};
    const desiredChannel: 'email'|'whatsapp' = (String(channel || '').toLowerCase() === 'whatsapp') ? 'whatsapp' : 'email';

    if (!tour_id || !profile_id) {
      return new Response(JSON.stringify({ error: 'Bad Request', details: { missing_tour_id: !tour_id, missing_profile_id: !profile_id } }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (desiredChannel === 'email' && (!BREVO_KEY || !BREVO_FROM)) {
      return new Response(JSON.stringify({ error: 'Server misconfigured (email)' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Fetch tour + profile
    const [tourRes, techRes] = await Promise.all([
      supabase.from('tours').select('id,name,start_date,end_date').eq('id', tour_id).maybeSingle(),
      supabase.from('profiles').select('id,first_name,last_name,email,phone').eq('id', profile_id).maybeSingle(),
    ]);
    if (tourRes.error || !tourRes.data) {
      return new Response(JSON.stringify({ error: 'Tour not found', details: tourRes.error }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    if (techRes.error || !techRes.data) {
      return new Response(JSON.stringify({ error: 'Profile not found', details: techRes.error }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const tour = tourRes.data as any;
    const tech = techRes.data as any;

    // Optional: sign the tour PDF path
    let tourPdfUrl: string | null = null;
    try {
      if (typeof tour_pdf_path === 'string' && tour_pdf_path.trim()) {
        const { data: signed } = await supabase.storage.from('tour-documents').createSignedUrl(tour_pdf_path, 60 * 60 * 24 * 7);
        if (signed?.signedUrl) tourPdfUrl = signed.signedUrl;
      }
    } catch {}

    // Utilities for pretty dates
    const COMPANY_TZ = Deno.env.get('COMPANY_TZ') || 'Europe/Madrid';
    const fmtDate = (d?: string | null) => d ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: COMPANY_TZ }).format(new Date(d)) : 'TBD';
    const rangeStr = `${fmtDate(tour.start_date)}${tour.end_date ? ` — ${fmtDate(tour.end_date)}` : ''}`;
    const fullName = `${tech.first_name || ''} ${tech.last_name || ''}`.trim();
    const subject = `Disponibilidad para gira: ${tour.name}`;
    const safeMsg = (message ?? '').toString().replace(/</g, '&lt;').replace(/\n/g, '<br/>');

    if (desiredChannel === 'whatsapp') {
      // Require sender WA config
      if (!requesterProfile?.waha_endpoint) {
        return new Response(JSON.stringify({ error: 'User not authorized for WhatsApp operations' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!tech.phone) {
        return new Response(JSON.stringify({ error: 'Profile has no phone number for WhatsApp' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      // Build WhatsApp text
      const lines: string[] = [];
      lines.push(`Hola ${fullName || ''},`);
      lines.push(`¿Podrías revisar tu disponibilidad para la gira "${tour.name}" (${rangeStr})?`);
      if (tourPdfUrl) {
        lines.push('');
        lines.push(`Calendario del tour (PDF): ${tourPdfUrl}`);
      }
      if ((message || '').toString().trim()) {
        lines.push('');
        lines.push((message as string).trim());
      }
      lines.push('');
      lines.push('Por favor responde por aquí con tus fechas disponibles. ¡Gracias!');
      const text = lines.join('\n');

      // WAHA send
      const normalizeBase = (s: string) => { let b=(s||'').trim(); if (!/^https?:\/\//i.test(b)) b='https://'+b; return b.replace(/\/+$/, ''); };
      const base = normalizeBase(requesterProfile.waha_endpoint);
      const { data: cfg } = await supabase.rpc('get_waha_config', { base_url: base });
      const apiKey = (cfg?.[0] as any)?.api_key || Deno.env.get('WAHA_API_KEY') || '';
      const session = (cfg?.[0] as any)?.session || Deno.env.get('WAHA_SESSION') || 'default';
      const defaultCC = Deno.env.get('WA_DEFAULT_COUNTRY_CODE') || '+34';
      const headersWA: Record<string,string> = { 'Content-Type':'application/json' };
      if (apiKey) headersWA['X-API-Key'] = apiKey;
      function normalizePhone(raw: string, cc: string): string | null {
        let d = (raw||'').trim().replace(/[\s\-()]/g,'');
        if (!d) return null; if (d.startsWith('00')) d = '+'+d.slice(2); if (!d.startsWith('+')) d = (cc.startsWith('+')?cc:'+'+cc)+d; if (!/^\+\d{7,15}$/.test(d)) return null; return d; }
      const jid = (normalizePhone(tech.phone, defaultCC) || '').replace(/^\+/, '').replace(/\D/g,'') + '@c.us';
      const sendUrl = `${base}/api/sendText`;
      const resp = await fetch(sendUrl, { method:'POST', headers: headersWA, body: JSON.stringify({ chatId: jid, text, session, linkPreview: false }) });
      if (resp.ok) {
        return new Response(JSON.stringify({ success: true, channel: 'whatsapp' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const errTxt = await resp.text().catch(()=>'');
      return new Response(JSON.stringify({ error: 'WhatsApp delivery failed', details: { status: resp.status, body: errTxt } }), { status: resp.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Email channel
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
                    ¿Puedes revisar tu disponibilidad para la gira <b>${tour.name}</b> (${rangeStr})?
                  </p>
                  ${safeMsg ? `<p style=\"margin:12px 0 0 0;color:#374151;\">${safeMsg}</p>` : ''}
                </td>
              </tr>
              ${tourPdfUrl ? `
              <tr>
                <td style="padding:12px 24px 0 24px;">
                  <div style=\"background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;\">
                    <div style=\"font-weight:600;color:#9a3412;margin-bottom:4px;\">Calendario del tour (PDF)</div>
                    <a href=\"${tourPdfUrl}\" style=\"color:#9a3412;text-decoration:underline;\">Descargar PDF</a>
                  </div>
                </td>
              </tr>` : ''}
              <tr>
                <td style="padding:16px 24px 24px 24px;">
                  <p style="margin:0;color:#374151;line-height:1.55;">Responde a este correo con tus fechas disponibles. ¡Gracias!</p>
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

    const emailPayload = { sender: { email: BREVO_FROM }, to: [{ email: tech.email }], subject, htmlContent: html } as const;
    const sendRes = await fetch('https://api.brevo.com/v3/smtp/email', { method:'POST', headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(emailPayload) });
    if (!sendRes.ok) {
      const t = await sendRes.text().catch(()=>'');
      return new Response(JSON.stringify({ error: 'Email delivery failed', details: { status: sendRes.status, message: t } }), { status: sendRes.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    return new Response(JSON.stringify({ success: true, channel: 'email' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    console.error('[send-tour-availability] error:', err);
    return new Response('Server error', { status: 500, headers: corsHeaders });
  }
});
